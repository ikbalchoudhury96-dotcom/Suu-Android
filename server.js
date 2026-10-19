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
  const { message, provider } = req.body;

  if (!message) {
    return res.status(400).json({
      error: "Message is required"
    });
  }

  const providers = provider === "openai"
    ? ["openai", "gemini"]
    : provider === "gemini"
      ? ["gemini", "openai"]
      : ["gemini", "openai"];

  for (const ai of providers) {
    try {
      let response;

      if (ai === "gemini" && process.env.GEMINI_API_KEY) {
        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: message }]
              }]
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error("Gemini API request failed");
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        if (!reply) throw new Error("Empty Gemini response");

        return res.json({ reply, provider: "gemini" });
      }

      if (ai === "openai" && process.env.OPENAI_API_KEY) {
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

        const data = await response.json();

        if (!response.ok) {
          throw new Error("OpenAI API request failed");
        }

        const reply = data.output
          ?.flatMap(item => item.content || [])
          .filter(item => item.type === "output_text")
          .map(item => item.text)
          .join("");

        if (!reply) throw new Error("Empty OpenAI response");

        return res.json({ reply, provider: "openai" });
      }
    } catch (error) {
      console.error(`${ai} request failed:`, error.message);
    }
  }

  res.status(502).json({
    error: "Both AI providers failed or are not configured."
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Suu backend running on port ${PORT}`);
});
