import crypto from "crypto";

const MODEL = "gemini-3.6-flash";
const GEMINI_TIMEOUT_MS = 45000;

const SYSTEM_INSTRUCTION = `
You are QV37 AI, an expert web application generator.

The user will describe an app or website they want.

Your job is to generate a COMPLETE, WORKING, STANDALONE HTML document.

Rules:
- Return ONLY the complete HTML document.
- Do not use Markdown fences.
- Do not explain the code.
- Include HTML, CSS and JavaScript in the same document.
- The result must work when opened directly in a browser.
- Use modern responsive design.
- Make the interface polished and professional.
- Make buttons and interactions actually work.
- Do not leave placeholder functionality.
- Do not require a backend unless absolutely necessary.
- Prefer browser APIs and client-side JavaScript for demos.
- Do not expose API keys or secrets.
- Do not use external APIs unless the user specifically requests them.
- Make the generated app usable on both mobile and desktop.
`;

function sendJson(res, status, data) {
  res.status(status);
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );
  return res.end(JSON.stringify(data));
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";

  const cookies = cookieHeader
    .split(";")
    .map((item) => item.trim());

  for (const cookie of cookies) {
    if (cookie.startsWith(name + "=")) {
      try {
        return decodeURIComponent(
          cookie.substring(name.length + 1)
        );
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function getLoggedInUser(
  supabaseUrl,
  supabaseSecretKey,
  accessToken
) {
  if (!accessToken) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseSecretKey
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  if (!user || !user.id) {
    return null;
  }

  return user;
}

async function callRpc(
  supabaseUrl,
  supabaseSecretKey,
  functionName,
  body
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    const text = await response.text();

    console.error(
      `Supabase RPC ${functionName} failed:`,
      text
    );

    throw new Error(
      `Supabase RPC ${functionName} failed`
    );
  }

  return response.json();
}

async function refundCredit(
  supabaseUrl,
  supabaseSecretKey,
  userId
) {
  try {
    await callRpc(
      supabaseUrl,
      supabaseSecretKey,
      "refund_user_credit",
      {
        p_user_id: userId
      }
    );

    console.log(
      "User credit refunded:",
      userId
    );
  } catch (error) {
    console.error(
      "Failed to refund user credit:",
      error
    );
  }
}

async function refundAnonymousTrial(
  supabaseUrl,
  supabaseSecretKey,
  trialId
) {
  if (!trialId) {
    return;
  }

  try {
    await callRpc(
      supabaseUrl,
      supabaseSecretKey,
      "refund_anonymous_trial",
      {
        p_trial_id: trialId
      }
    );

    console.log(
      "Anonymous trial refunded:",
      trialId
    );
  } catch (error) {
    console.error(
      "Failed to refund anonymous trial:",
      error
    );
  }
}

function extractGeminiText(data) {
  if (
    data &&
    Array.isArray(data.steps)
  ) {
    const pieces = [];

    for (const step of data.steps) {
      if (
        step &&
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const item of step.content) {
          if (
            item &&
            item.type === "text" &&
            typeof item.text === "string"
          ) {
            pieces.push(item.text);
          }
        }
      }
    }

    if (pieces.length > 0) {
      return pieces.join("");
    }
  }

  if (
    data &&
    Array.isArray(data.outputs)
  ) {
    const pieces = [];

    for (const output of data.outputs) {
      if (
        output &&
        typeof output.text === "string"
      ) {
        pieces.push(output.text);
      }

      if (
        output &&
        Array.isArray(output.content)
      ) {
        for (const item of output.content) {
          if (
            item &&
            typeof item.text === "string"
          ) {
            pieces.push(item.text);
          }
        }
      }
    }

    if (pieces.length > 0) {
      return pieces.join("");
    }
  }

  return "";
}

function cleanHtml(text) {
  let html = String(text || "").trim();

  html = html.replace(
    /^```html\s*/i,
    ""
  );

  html = html.replace(
    /^```\s*/i,
    ""
  );

  html = html.replace(
    /\s*```$/i,
    ""
  );

  return html.trim();
}

function looksLikeHtml(html) {
  if (!html) {
    return false;
  }

  const lower = html.toLowerCase();

  return (
    lower.includes("<html") ||
    lower.includes("<!doctype html")
  );
}

async function callGemini(
  geminiApiKey,
  prompt
) {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      GEMINI_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              geminiApiKey
          },

          body: JSON.stringify({
            model: MODEL,

            input: prompt,

            system_instruction:
              SYSTEM_INSTRUCTION,

            generation_config: {
              thinking_level:
                "minimal"
            }
          }),

          signal: controller.signal
        }
      );

    const responseText =
      await response.text();

    if (!response.ok) {
      console.error(
        "Gemini HTTP error:",
        response.status,
        responseText
      );

      let message =
        "Gemini could not generate the app.";

      try {
        const errorData =
          JSON.parse(responseText);

        if (
          errorData?.error?.message
        ) {
          message =
            errorData.error.message;
        }
      } catch {
        // Keep generic message.
      }

      const error =
        new Error(message);

      error.status =
        response.status;

      throw error;
    }

    let data;

    try {
      data =
        JSON.parse(responseText);
    } catch {
      throw new Error(
        "Gemini returned an invalid response."
      );
    }

    const html =
      cleanHtml(
        extractGeminiText(data)
      );

    if (!looksLikeHtml(html)) {
      throw new Error(
        "Gemini did not return a valid HTML app."
      );
    }

    return html;

  } catch (error) {

    if (
      error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Gemini took too long to respond."
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return sendJson(
      res,
      405,
      {
        error:
          "Method not allowed."
      }
    );
  }

  const geminiApiKey =
    process.env.GEMINI_API_KEY;

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  const creatorEmail =
    (
      process.env.CREATOR_EMAIL ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    !geminiApiKey ||
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    console.error(
      "Missing required environment variables."
    );

    return sendJson(
      res,
      500,
      {
        error:
          "Server configuration is incomplete."
      }
    );
  }

  let creditConsumed = false;
  let anonymousTrialConsumed = false;

  let userId = null;
  let trialId = null;

  let isCreator = false;

  try {

    /*
     * --------------------------------------------------
     * PROMPT
     * --------------------------------------------------
     */

    const prompt =
      req.body &&
      typeof req.body.prompt === "string"
        ? req.body.prompt.trim()
        : "";

    if (!prompt) {
      return sendJson(
        res,
        400,
        {
          error:
            "Please describe the app or website you want to build."
        }
      );
    }

    if (prompt.length > 12000) {
      return sendJson(
        res,
        400,
        {
          error:
            "Your request is too long. Please shorten it and try again."
        }
      );
    }


    /*
     * --------------------------------------------------
     * AUTHENTICATION
     * --------------------------------------------------
     */

    const authHeader =
      req.headers.authorization || "";

    let accessToken = null;

    if (
      authHeader.startsWith(
        "Bearer "
      )
    ) {
      accessToken =
        authHeader.substring(7);
    }

    const user =
      await getLoggedInUser(
        supabaseUrl,
        supabaseSecretKey,
        accessToken
      );


    /*
     * --------------------------------------------------
     * CREATOR DETECTION
     * --------------------------------------------------
     */

    if (user) {

      userId = user.id;

      const loggedInEmail =
        (
          user.email ||
          ""
        )
          .trim()
          .toLowerCase();

      isCreator =
        Boolean(
          creatorEmail &&
          loggedInEmail ===
            creatorEmail
        );

      console.log(
        "QV37 authentication:",
        {
          userId,
          email: loggedInEmail,
          creator: isCreator
        }
      );
    }


    /*
     * --------------------------------------------------
     * CREATOR MODE
     * --------------------------------------------------
     *
     * Creator does NOT consume credits.
     *
     * Creator does NOT use anonymous trial.
     */

    if (isCreator) {

      console.log(
        "QV37 CREATOR MODE: unlimited testing"
      );

    }

    /*
     * --------------------------------------------------
     * NORMAL LOGGED-IN USER
     * --------------------------------------------------
     */

    else if (userId) {

      const remaining =
        await callRpc(
          supabaseUrl,
          supabaseSecretKey,
          "consume_user_credit",
          {
            p_user_id: userId
          }
        );

      const balance =
        Number(remaining);

      if (
        !Number.isFinite(balance) ||
        balance < 0
      ) {
        return sendJson(
          res,
          402,
          {
            error:
              "You've used all your available credits. Please buy more credits to continue building.",
            credits: 0,
            creator: false
          }
        );
      }

      creditConsumed = true;

      console.log(
        "User credit consumed. Remaining:",
        balance
      );
    }

    /*
     * --------------------------------------------------
     * ANONYMOUS USER
     * --------------------------------------------------
     */

    else {

      trialId =
        getCookie(
          req,
          "qv37_trial_id"
        );

      if (!trialId) {

        trialId =
          crypto.randomUUID();

        res.setHeader(
          "Set-Cookie",
          `qv37_trial_id=${encodeURIComponent(
            trialId
          )}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
        );
      }

      const trialAllowed =
        await callRpc(
          supabaseUrl,
          supabaseSecretKey,
          "consume_anonymous_trial",
          {
            p_trial_id: trialId
          }
        );

      if (!trialAllowed) {
        return sendJson(
          res,
          402,
          {
            error:
              "Your free anonymous generation has already been used. Please sign up or log in to continue.",
            creator: false
          }
        );
      }

      anonymousTrialConsumed =
        true;

      console.log(
        "Anonymous trial consumed."
      );
    }


    /*
     * --------------------------------------------------
     * GEMINI
     * --------------------------------------------------
     */

    let html;

    try {

      html =
        await callGemini(
          geminiApiKey,
          prompt
        );

    } catch (geminiError) {

      console.error(
        "Gemini generation failed:",
        geminiError
      );


      /*
       * Creator does not need a refund
       * because creator never consumed a credit.
       */

      if (
        creditConsumed &&
        userId
      ) {

        await refundCredit(
          supabaseUrl,
          supabaseSecretKey,
          userId
        );

        creditConsumed =
          false;
      }


      if (
        anonymousTrialConsumed &&
        trialId
      ) {

        await refundAnonymousTrial(
          supabaseUrl,
          supabaseSecretKey,
          trialId
        );

        anonymousTrialConsumed =
          false;
      }


      return sendJson(
        res,
        503,
        {
          error:
            geminiError?.message ||
            "The AI service is temporarily unavailable. Your credit has been refunded. Please try again.",
          creator:
            isCreator
        }
      );
    }


    /*
     * --------------------------------------------------
     * READ REMAINING CREDITS
     * --------------------------------------------------
     *
     * Creator does not need a credit balance.
     */

    let remainingCredits = null;

    if (
      userId &&
      !isCreator
    ) {

      try {

        remainingCredits =
          await callRpc(
            supabaseUrl,
            supabaseSecretKey,
            "ensure_user_credits",
            {
              p_user_id: userId,
              p_trial_id: null
            }
          );

        remainingCredits =
          Number(
            remainingCredits
          );

      } catch (error) {

        console.error(
          "Unable to read remaining credits:",
          error
        );

        remainingCredits =
          null;
      }
    }


    /*
     * --------------------------------------------------
     * SUCCESS
     * --------------------------------------------------
     */

    return sendJson(
      res,
      200,
      {
        success: true,

        html,

        credits:
          isCreator
            ? null
            : remainingCredits,

        creator:
          isCreator,

        anonymous:
          !userId
      }
    );

  } catch (error) {

    console.error(
      "Generate handler error:",
      error
    );


    /*
     * Safety refund for normal users.
     * Creator never reaches this with
     * creditConsumed = true.
     */

    if (
      creditConsumed &&
      userId
    ) {

      await refundCredit(
        supabaseUrl,
        supabaseSecretKey,
        userId
      );
    }


    if (
      anonymousTrialConsumed &&
      trialId
    ) {

      await refundAnonymousTrial(
        supabaseUrl,
        supabaseSecretKey,
        trialId
      );
    }


    return sendJson(
      res,
      500,
      {
        error:
          "An unexpected server error occurred. Your credit has been refunded. Please try again.",
        creator:
          isCreator
      }
    );
  }
}
