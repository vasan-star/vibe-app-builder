export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "A prompt is required."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    const aiPrompt = `
You are QV37 AI, an AI website and application builder.

The user wants to build:

${prompt}

Generate a complete standalone HTML application.

Requirements:
- Return ONLY the complete HTML code.
- Include HTML, CSS and JavaScript in one file.
- Make it responsive for mobile and desktop.
- Make buttons and interactive features functional where possible.
- Do not use markdown code fences.
- Do not explain the code.
- Do not return anything except the HTML application.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model: "gemini-3.6-flash",
          input: aiPrompt,
          store: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Interactions API error:", data);

      return res.status(response.status || 500).json({
        error:
          data?.error?.message ||
          data?.error?.status ||
          "Gemini API request failed."
      });
    }

    let generatedText = "";

    if (Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        if (step?.type !== "model_output") {
          continue;
        }

        if (Array.isArray(step?.content)) {
          for (const item of step.content) {
            if (
              item?.type === "text" &&
              typeof item?.text === "string"
            ) {
              generatedText += item.text;
            }
          }
        }
      }
    }

    if (!generatedText.trim()) {
      return res.status(500).json({
        error: "Gemini returned no application code."
      });
    }

    const html = generatedText
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return res.status(200).json({
      html
    });

  } catch (error) {
    console.error("QV37 server error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error while generating the application."
    });
  }
}
