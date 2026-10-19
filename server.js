const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Suu backend status
app.get("/", (req, res) => {
  res.json({
    app: "Suu AI Backend",
    status: "online"
  });
});

// Suu natural AI voice endpoint
app.post("/voice", async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      error: "Please provide text to speak."
    });
  }

  if (text.length > 4000) {
    return res.status(413).json({
      error: "Text is too long."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      error: "Gemini API key is missing."
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: text.trim(),
              speech_metadata: {
                style: "Speak naturally in Hindi or Hinglish with a warm, gentle, friendly Indian conversational style and relaxed pace."
              }
            }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
  prebuiltVoiceConfig: {
    voiceName: "Kore"
  }
              }
              }
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini voice error:",
        response.status,
        data.error?.message || "Unknown error"
      );

      return res.status(502).json({
        error: "Gemini voice generation failed.",
        details: data.error?.message || "Check Gemini TTS API access."
      });
    }

    const audioPart =
      data.candidates?.[0]?.content?.parts?.find(
        part => part.inlineData?.data
      );

    if (!audioPart) {
      return res.status(502).json({
        error: "Gemini did not return audio."
      });
    }

    return res.json({
      audioBase64: audioPart.inlineData.data,
      mimeType: audioPart.inlineData.mimeType || "audio/wav"
    });

  } catch (error) {
    console.error("Voice endpoint error:", error.message);

    return res.status(502).json({
      error: "Could not generate Suu voice."
    });
  }
});

// AI chat endpoint
app.post("/chat", async (req, res) => {
  const { message, provider } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Please provide a message."
    });
  }

  // Default: Blues Minds. Other providers remain available as fallback.
  let providers;

  if (provider === "gemini") {
    providers = ["gemini", "bluesminds", "openai"];
  } else if (provider === "openai") {
    providers = ["openai", "bluesminds", "gemini"];
  } else {
    providers = ["bluesminds", "gemini", "openai"];
  }

  const errors = [];

  for (const ai of providers) {
    try {
      let response;
      let data;
      let reply;

      // BLUES MINDS AI
      if (ai === "bluesminds") {
        const apiKey = process.env.BLUESMINDS_API_KEY;

        if (!apiKey) {
          throw new Error(
            "BLUESMINDS_API_KEY is missing in Render."
          );
        }

        const baseUrl = (
          process.env.BLUESMINDS_BASE_URL ||
          "https://api.bluesminds.com/v1"
        ).replace(/\/+$/, "");

        response = await fetch(
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "openai/gpt-oss-20b",
              messages: [
                {
                  role: "system",
                  content:
                    "You are Suu, a friendly AI companion. " +
                    "Reply naturally in Hindi or Hinglish when " +
                    "the user does. Be warm, helpful and concise."
                },
                {
                  role: "user",
                  content: message
                }
              ],
              temperature: 0.7
            })
          }
        );

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Blues Minds HTTP ${response.status}: ` +
            `${data.error?.message || JSON.stringify(data)}`
          );
        }

        reply = data.choices?.[0]?.message?.content;

        if (Array.isArray(reply)) {
          reply = reply
            .map(part => part.text || "")
            .join("");
        }

        if (!reply || typeof reply !== "string") {
          throw new Error(
            "Blues Minds returned an empty response."
          );
        }

        return res.json({
          reply,
          provider: "bluesminds",
          model: "openai/gpt-oss-20b"
        });
      }

      // GEMINI FALLBACK
      if (ai === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          throw new Error("GEMINI_API_KEY is missing.");
        }

        response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: message }]
                }
              ]
            })
          }
        );

        data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Gemini HTTP ${response.status}: ` +
            `${data.error?.message || JSON.stringify(data)}`
          );
        }

        reply = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        if (!reply) {
          throw new Error("Gemini returned an empty response.");
        }

        return res.json({
          reply,
          provider: "gemini"
        });
      }

      // OPENAI FALLBACK
      if (ai === "openai") {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
          throw new Error("OPENAI_API_KEY is missing.");
        }

        response = await fetch(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
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
            `OpenAI HTTP ${response.status}: ` +
            `${data.error?.message || JSON.stringify(data)}`
          );
        }

        reply = (data.output || [])
          .flatMap(item => item.content || [])
          .filter(item => item.type === "output_text")
          .map(item => item.text)
          .join("");

        if (!reply) {
          throw new Error("OpenAI returned an empty response.");
        }

        return res.json({
          reply,
          provider: "openai"
        });
      }
    } catch (error) {
      console.error(`${ai} request failed:`, error.message);
      errors.push(`${ai}: ${error.message}`);
    }
  }

  return res.status(502).json({
    error: "All configured AI providers failed.",
    details: errors
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Suu backend running on port ${PORT}`);
});
