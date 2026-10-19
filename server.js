const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    app: "Suu AI Backend",
    status: "online"
  });
});

app.post("/chat", async (req, res) => {
  const { message, provider } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Please provide a message."
    });
  }

  let providers;

  if (provider === "gemini") {
    providers = ["gemini", "openai"];
  } else if (provider === "openai") {
    providers = ["openai", "gemini"];
  } else {
    providers = ["gemini", "openai"];
  }

  const errors = [];

  for (const ai of providers) {
    try {
      let response;
      let data;
      let reply;

      // GEMINI AI
      if (ai === "gemini") {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is missing in Render.");
        }

        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: message
                    }
                  ]
                }
              ]
            })
          }
        );

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Gemini HTTP ${response.status}: ${
              data.error?.message || JSON.stringify(data)
            }`
          );
        }

        reply = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("");

        if (!reply) {
          throw new Error("Gemini returned an empty response.");
        }

        return res.json({
          reply: reply,
          provider: "gemini"
        });
      }

      // OPENAI
      if (ai === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY is missing in Render.");
        }

        response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              input: message
            })
          }
        );

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            `OpenAI HTTP ${response.status}: ${
              data.error?.message || JSON.stringify(data)
            }`
          );
        }

        reply = (data.output || [])
          .flatMap((item) => item.content || [])
          .filter((item) => item.type === "output_text")
          .map((item) => item.text)
          .join("");

        if (!reply) {
          throw new Error("OpenAI returned an empty response.");
        }

        return res.json({
          reply: reply,
          provider: "openai"
        });
      }
    } catch (error) {
      console.error(`${ai} request failed:`, error.message);
      errors.push(`${ai}: ${error.message}`);
    }
  }

  return res.status(502).json({
    error: "Both AI providers failed.",
    details: errors
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Suu backend running on port ${PORT}`);
});
