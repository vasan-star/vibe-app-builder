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
You are QV37 AI, a professional AI website and application builder.

USER REQUEST:
${prompt}

Your task is to create a COMPLETE, WORKING, STANDALONE web application.

IMPORTANT QUALITY REQUIREMENTS:

1. Return ONLY the complete HTML document.
2. Put ALL HTML, CSS and JavaScript inside the single HTML document.
3. Do not use markdown code fences.
4. Do not explain anything outside the HTML.
5. Make the application responsive on mobile, tablet and desktop.
6. Make the interface polished, modern and professional.
7. Every visible button must have a working action.
8. Every form, input, menu, tab, modal, calculator operation, cart operation,
   search function and other interactive feature requested by the user must work.
9. Use reliable vanilla JavaScript unless another approach is specifically required.
10. Make sure JavaScript runs after the DOM elements exist.
11. Use correct element IDs and class names consistently.
12. Do not reference JavaScript functions or variables that do not exist.
13. Do not leave placeholder buttons that do nothing.
14. Do not create fake functionality when real local functionality can be implemented.
15. For calculators:
    - Number buttons must enter numbers.
    - Decimal must work.
    - Addition, subtraction, multiplication and division must work.
    - Equals must calculate the result.
    - Clear must reset the calculator.
    - Delete/backspace should work when included.
    - Prevent invalid calculations where reasonably possible.
16. For shopping applications:
    - Add-to-cart buttons must actually add products.
    - Cart quantity must update.
    - Remove buttons must work.
    - Total price must update.
    - Checkout interaction must work locally.
17. For forms:
    - Validate required fields.
    - Show useful success/error messages.
18. Avoid JavaScript syntax errors.
19. Avoid missing event listeners.
20. Avoid broken selectors.
21. Avoid external dependencies unless they are necessary.
22. If external resources are used, provide sensible fallbacks.
23. Before returning the HTML, internally review the JavaScript logic and
    make sure the requested interactive features are connected and functional.
24. The generated application must work when placed directly into an iframe
    using srcdoc.
25. Do not include server-side code, API keys or secrets in the generated app.
26. The generated application should work entirely on the client side unless
    the user's request specifically requires a backend.

FINAL OUTPUT:
Return ONLY the complete standalone HTML application.
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
      console.error("Gemini API error:", data);

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

    if (!html.toLowerCase().includes("<html")) {
      return res.status(500).json({
        error: "Gemini returned invalid HTML."
      });
    }

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
