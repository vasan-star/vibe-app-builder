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

    if (prompt.length > 12000) {
      return res.status(400).json({
        error: "Prompt is too long. Please keep it under 12,000 characters."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    if (!supabaseUrl || !supabaseSecretKey) {
      return res.status(500).json({
        error: "Supabase environment variables are not configured in Vercel."
      });
    }

    /*
     * ---------------------------------------------------------
     * AUTHENTICATION / ANONYMOUS TRIAL
     * ---------------------------------------------------------
     */

    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.substring(7)
      : "";

    let userId = null;

    /*
     * If the visitor is logged in, verify the Supabase access token.
     */
    if (accessToken) {
      const userResponse = await fetch(
        `${supabaseUrl}/auth/v1/user`,
        {
          method: "GET",
          headers: {
            "apikey": supabaseSecretKey,
            "Authorization": `Bearer ${accessToken}`
          }
        }
      );

      if (!userResponse.ok) {
        return res.status(401).json({
          error: "Your login session is invalid or expired. Please log in again."
        });
      }

      const userData = await userResponse.json();

      if (!userData?.id) {
        return res.status(401).json({
          error: "Unable to verify your account."
        });
      }

      userId = userData.id;
    }

    /*
     * ---------------------------------------------------------
     * GET ANONYMOUS TRIAL COOKIE
     * ---------------------------------------------------------
     */

    const cookieHeader = req.headers.cookie || "";

    function getCookie(name) {
      const cookies = cookieHeader.split(";");

      for (const cookie of cookies) {
        const parts = cookie.trim().split("=");

        if (parts[0] === name) {
          return decodeURIComponent(parts.slice(1).join("="));
        }
      }

      return null;
    }

    let trialId = getCookie("qv37_trial_id");

    /*
     * Create a random anonymous trial ID if needed.
     */
    if (!trialId) {
      trialId = crypto.randomUUID();

      res.setHeader(
        "Set-Cookie",
        `qv37_trial_id=${encodeURIComponent(
          trialId
        )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
      );
    }

    /*
     * ---------------------------------------------------------
     * CREDIT RESERVATION
     * ---------------------------------------------------------
     */

    let creditType = null;
    let remainingCredits = null;

    /*
     * LOGGED-IN USER
     */
    if (userId) {
      const creditResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/consume_user_credit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseSecretKey,
            "Authorization": `Bearer ${supabaseSecretKey}`
          },
          body: JSON.stringify({
            p_user_id: userId
          })
        }
      );

      if (!creditResponse.ok) {
        console.error(
          "Supabase credit error:",
          await creditResponse.text()
        );

        return res.status(500).json({
          error: "Unable to check your credits."
        });
      }

      const balance = await creditResponse.json();

      if (typeof balance !== "number" || balance < 0) {
        return res.status(402).json({
          error: "You have no credits remaining. Please buy more credits.",
          credits: 0,
          paymentRequired: true
        });
      }

      creditType = "user";
      remainingCredits = balance;
    }

    /*
     * ANONYMOUS VISITOR
     */
    else {
      const trialResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/consume_anonymous_trial`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseSecretKey,
            "Authorization": `Bearer ${supabaseSecretKey}`
          },
          body: JSON.stringify({
            p_trial_id: trialId
          })
        }
      );

      if (!trialResponse.ok) {
        console.error(
          "Supabase anonymous trial error:",
          await trialResponse.text()
        );

        return res.status(500).json({
          error: "Unable to check your free trial."
        });
      }

      const trialAllowed = await trialResponse.json();

      if (trialAllowed !== true) {
        return res.status(401).json({
          error:
            "Your free anonymous generation has already been used. Please sign up or log in to continue.",
          anonymousTrialUsed: true,
          loginRequired: true
        });
      }

      creditType = "anonymous";
      remainingCredits = 0;
    }

    /*
     * ---------------------------------------------------------
     * GEMINI GENERATION
     * ---------------------------------------------------------
     */

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

    /*
     * ---------------------------------------------------------
     * GEMINI FAILED → REFUND CREDIT
     * ---------------------------------------------------------
     */

    if (!response.ok) {
      console.error("Gemini API error:", data);

      if (creditType === "user") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_user_credit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_user_id: userId
            })
          }
        );
      }

      if (creditType === "anonymous") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_anonymous_trial`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_trial_id: trialId
            })
          }
        );
      }

      return res.status(response.status || 500).json({
        error:
          data?.error?.message ||
          data?.error?.status ||
          "Gemini API request failed."
      });
    }

    /*
     * ---------------------------------------------------------
     * EXTRACT GENERATED HTML
     * ---------------------------------------------------------
     */

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

    /*
     * If Gemini returned no code, refund the credit.
     */

    if (!generatedText.trim()) {
      if (creditType === "user") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_user_credit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_user_id: userId
            })
          }
        );
      }

      if (creditType === "anonymous") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_anonymous_trial`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_trial_id: trialId
            })
          }
        );
      }

      return res.status(500).json({
        error: "Gemini returned no application code."
      });
    }

    const html = generatedText
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    /*
     * Invalid HTML → refund credit.
     */

    if (!html.toLowerCase().includes("<html")) {
      if (creditType === "user") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_user_credit`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_user_id: userId
            })
          }
        );
      }

      if (creditType === "anonymous") {
        await fetch(
          `${supabaseUrl}/rest/v1/rpc/refund_anonymous_trial`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": supabaseSecretKey,
              "Authorization": `Bearer ${supabaseSecretKey}`
            },
            body: JSON.stringify({
              p_trial_id: trialId
            })
          }
        );
      }

      return res.status(500).json({
        error: "Gemini returned invalid HTML."
      });
    }

    /*
     * ---------------------------------------------------------
     * SUCCESS
     * ---------------------------------------------------------
     */

    return res.status(200).json({
      html,
      credits: remainingCredits,
      anonymous: !userId
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
