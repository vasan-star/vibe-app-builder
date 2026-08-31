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
        error: "GEMINI_API_KEY is not configured."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey),
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
You are QV37 AI, an AI website and application builder.

The user wants to build:

${prompt}

Generate a complete standalone HTML application.

Requirements:
- Return ONLY the HTML code.
- Include HTML, CSS and JavaScript in one file.
- Make it responsive for mobile and desktop.
- Make buttons functional where possible.
- Do not use markdown code fences.
- Do not explain the code.
- Do not include <html> code fences.
`
                }
              ]
            }
          ],

          generationConfig: {
            temperature: 0.2
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(500).json({
        error: "Gemini API request failed."
      });
    }

    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
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

    console.error(error);

    return res.status(500).json({
      error: "Server error while generating the application."
    });
  }
}
