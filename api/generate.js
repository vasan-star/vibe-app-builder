import crypto from "crypto";

/*
  QV37 AI
  GEMINI GENERATION API

  IMPORTANT:
  - Gemini API key stays on the server.
  - Creator is verified by server-side email.
  - Creator does not consume credits.
  - Normal users consume one credit per successful generation attempt.
  - If Gemini fails, the consumed credit is refunded.
  - Anonymous trial is refunded if Gemini fails.
*/

/*
  VERCEL FUNCTION TIMEOUT

  Gemini can take longer when generating a complete application.
*/
export const maxDuration = 120;


/*
  CONFIGURATION
*/

const MODEL = "gemini-3.6-flash";

const GEMINI_TIMEOUT_MS = 110000;


/*
  SYSTEM INSTRUCTION
*/

const SYSTEM_INSTRUCTION = `
You are QV37 AI, an expert web application generator.

The user will describe an app or website they want.

Generate a COMPLETE, WORKING, STANDALONE HTML document.

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
- Keep the generated application reasonably efficient.
- Do not generate unnecessary explanations outside the HTML document.
`;


/*
  JSON RESPONSE
*/

function sendJson(res, status, data) {

  res.status(status);

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  return res.end(
    JSON.stringify(data)
  );
}


/*
  COOKIE
*/

function getCookie(req, name) {

  const cookieHeader =
    req.headers.cookie || "";

  const cookies =
    cookieHeader
      .split(";")
      .map(
        (item) =>
          item.trim()
      );

  for (const cookie of cookies) {

    if (
      cookie.startsWith(
        name + "="
      )
    ) {

      try {

        return decodeURIComponent(
          cookie.substring(
            name.length + 1
          )
        );

      } catch {

        return null;

      }
    }
  }

  return null;
}


/*
  SUPABASE USER VERIFICATION

  This verifies the access token against
  Supabase Auth on the server.
*/

async function getLoggedInUser(
  supabaseUrl,
  supabaseSecretKey,
  accessToken
) {

  if (!accessToken) {
    return null;
  }

  const response =
    await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          apikey:
            supabaseSecretKey
        }
      }
    );

  if (!response.ok) {
    return null;
  }

  const user =
    await response.json();

  if (
    !user ||
    !user.id
  ) {
    return null;
  }

  return user;
}


/*
  SUPABASE RPC
*/

async function callRpc(
  supabaseUrl,
  supabaseSecretKey,
  functionName,
  body
) {

  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`
        },

        body:
          JSON.stringify(body)
      }
    );

  if (!response.ok) {

    const text =
      await response.text();

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


/*
  REFUND NORMAL USER CREDIT
*/

async function refundCredit(
  supabaseUrl,
  supabaseSecretKey,
  userId
) {

  if (!userId) {
    return;
  }

  try {

    await callRpc(
      supabaseUrl,
      supabaseSecretKey,
      "refund_user_credit",
      {
        p_user_id:
          userId
      }
    );

    console.log(
      "QV37 credit refunded:",
      userId
    );

  } catch (error) {

    console.error(
      "QV37 credit refund failed:",
      error
    );
  }
}


/*
  REFUND ANONYMOUS TRIAL
*/

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
        p_trial_id:
          trialId
      }
    );

    console.log(
      "QV37 anonymous trial refunded:",
      trialId
    );

  } catch (error) {

    console.error(
      "QV37 anonymous trial refund failed:",
      error
    );
  }
}


/*
  EXTRACT GEMINI TEXT

  Handles the Interactions API response.
*/

function extractGeminiText(data) {

  /*
    Preferred response structure:
    steps -> model_output -> content -> text
  */

  if (
    data &&
    Array.isArray(data.steps)
  ) {

    const pieces = [];

    for (
      const step of data.steps
    ) {

      if (
        !step ||
        step.type !==
          "model_output"
      ) {
        continue;
      }

      if (
        !Array.isArray(
          step.content
        )
      ) {
        continue;
      }

      for (
        const item of step.content
      ) {

        if (
          item &&
          item.type === "text" &&
          typeof item.text ===
            "string"
        ) {

          pieces.push(
            item.text
          );
        }
      }
    }

    if (
      pieces.length > 0
    ) {

      return pieces.join("");

    }
  }


  /*
    Fallback response structure.
  */

  if (
    data &&
    Array.isArray(data.outputs)
  ) {

    const pieces = [];

    for (
      const output of data.outputs
    ) {

      if (
        output &&
        typeof output.text ===
          "string"
      ) {

        pieces.push(
          output.text
        );
      }

      if (
        output &&
        Array.isArray(
          output.content
        )
      ) {

        for (
          const item of
            output.content
        ) {

          if (
            item &&
            typeof item.text ===
              "string"
          ) {

            pieces.push(
              item.text
            );
          }
        }
      }
    }

    if (
      pieces.length > 0
    ) {

      return pieces.join("");

    }
  }


  /*
    Some API responses may provide
    output_text directly.
  */

  if (
    data &&
    typeof data.output_text ===
      "string"
  ) {

    return data.output_text;

  }


  return "";
}


/*
  CLEAN GENERATED HTML
*/

function cleanHtml(text) {

  let html =
    String(
      text || ""
    ).trim();


  /*
    Remove opening Markdown fence.
  */

  html =
    html.replace(
      /^```html\s*/i,
      ""
    );


  html =
    html.replace(
      /^```\s*/i,
      ""
    );


  /*
    Remove closing Markdown fence.
  */

  html =
    html.replace(
      /\s*```$/i,
      ""
    );


  return html.trim();
}


/*
  CHECK WHETHER GEMINI ACTUALLY RETURNED HTML
*/

function looksLikeHtml(html) {

  if (!html) {
    return false;
  }

  const lower =
    html.toLowerCase();

  return (
    lower.includes(
      "<html"
    ) ||
    lower.includes(
      "<!doctype html"
    )
  );
}


/*
  GEMINI REQUEST
*/

async function callGemini(
  geminiApiKey,
  prompt
) {

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      function () {

        controller.abort();

      },
      GEMINI_TIMEOUT_MS
    );


  try {

    console.log(
      "QV37: Sending request to Gemini..."
    );


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

          body:
            JSON.stringify({

              model:
                MODEL,

              input:
                prompt,

              system_instruction:
                SYSTEM_INSTRUCTION,

              generation_config: {

                thinking_level:
                  "minimal"
              }

            }),

          signal:
            controller.signal
        }
      );


    const responseText =
      await response.text();


    console.log(
      "QV37 Gemini HTTP status:",
      response.status
    );


    /*
      GEMINI ERROR
    */

    if (!response.ok) {

      console.error(
        "Gemini HTTP error:",
        response.status,
        responseText
      );


      let message =
        "Gemini could not generate the application.";


      try {

        const errorData =
          JSON.parse(
            responseText
          );


        if (
          errorData &&
          errorData.error &&
          errorData.error.message
        ) {

          message =
            errorData.error.message;

        }

      } catch {

        /*
          Keep generic message.
        */
      }


      const error =
        new Error(message);


      error.status =
        response.status;


      throw error;
    }


    /*
      PARSE GEMINI RESPONSE
    */

    let data;


    try {

      data =
        JSON.parse(
          responseText
        );

    } catch {

      console.error(
        "Gemini returned invalid JSON:",
        responseText.substring(
          0,
          1000
        )
      );

      throw new Error(
        "Gemini returned an invalid response."
      );
    }


    /*
      EXTRACT HTML
    */

    const html =
      cleanHtml(
        extractGeminiText(
          data
        )
      );


    /*
      VALIDATE HTML
    */

    if (
      !looksLikeHtml(html)
    ) {

      console.error(
        "Gemini response did not contain valid HTML."
      );

      throw new Error(
        "Gemini did not return a valid HTML application."
      );
    }


    console.log(
      "QV37: Gemini generated HTML successfully."
    );


    console.log(
      "QV37 generated HTML length:",
      html.length
    );


    return html;


  } catch (error) {


    /*
      SERVER-SIDE TIMEOUT
    */

    if (
      error &&
      error.name ===
        "AbortError"
    ) {

      console.error(
        "QV37 Gemini request timed out after",
        GEMINI_TIMEOUT_MS,
        "ms."
      );


      const timeoutError =
        new Error(
          "Gemini took too long to generate the application. Please try again."
        );


      timeoutError.code =
        "GEMINI_TIMEOUT";


      throw timeoutError;
    }


    throw error;


  } finally {

    clearTimeout(
      timeout
    );

  }
}


/*
  MAIN VERCEL HANDLER
*/

export default async function handler(
  req,
  res
) {


  /*
    METHOD CHECK
  */

  if (
    req.method !==
    "POST"
  ) {

    return sendJson(
      res,
      405,
      {
        error:
          "Method not allowed."
      }
    );
  }


  /*
    ENVIRONMENT VARIABLES
  */

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


  /*
    CONFIGURATION CHECK
  */

  if (
    !geminiApiKey ||
    !supabaseUrl ||
    !supabaseSecretKey
  ) {

    console.error(
      "QV37: Missing required environment variables."
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


  /*
    STATE
  */

  let creditConsumed =
    false;

  let anonymousTrialConsumed =
    false;

  let userId =
    null;

  let trialId =
    null;

  let isCreator =
    false;


  try {


    /*
      ------------------------------------------------
      PROMPT
      ------------------------------------------------
    */

    const prompt =
      req.body &&
      typeof req.body.prompt ===
        "string"
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


    /*
      Prevent extremely large requests.
    */

    if (
      prompt.length >
      12000
    ) {

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
      ------------------------------------------------
      AUTHENTICATION
      ------------------------------------------------
    */

    const authHeader =
      req.headers.authorization ||
      "";

    let accessToken =
      null;


    if (
      authHeader.startsWith(
        "Bearer "
      )
    ) {

      accessToken =
        authHeader.substring(
          7
        );
    }


    const user =
      await getLoggedInUser(
        supabaseUrl,
        supabaseSecretKey,
        accessToken
      );


    /*
      ------------------------------------------------
      CREATOR DETECTION
      ------------------------------------------------
    */

    if (user) {

      userId =
        user.id;


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
          userId:
            userId,

          creator:
            isCreator
        }
      );
    }


    /*
      ------------------------------------------------
      CREATOR
      ------------------------------------------------

      Creator:
      - no credit consumption
      - no anonymous trial
      - unlimited testing
    */

    if (isCreator) {

      console.log(
        "QV37 CREATOR MODE: unlimited generation"
      );
    }


    /*
      ------------------------------------------------
      LOGGED-IN USER
      ------------------------------------------------
    */

    else if (userId) {

      const remaining =
        await callRpc(
          supabaseUrl,
          supabaseSecretKey,
          "consume_user_credit",
          {
            p_user_id:
              userId
          }
        );


      const balance =
        Number(
          remaining
        );


      /*
        No credits available.
      */

      if (
        !Number.isFinite(
          balance
        ) ||
        balance < 0
      ) {

        return sendJson(
          res,
          402,
          {
            error:
              "You've used all your available credits. Please buy more credits to continue building.",

            credits:
              0,

            creator:
              false
          }
        );
      }


      creditConsumed =
        true;


      console.log(
        "QV37 user credit consumed. Remaining:",
        balance
      );
    }


    /*
      ------------------------------------------------
      ANONYMOUS USER
      ------------------------------------------------
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
            p_trial_id:
              trialId
          }
        );


      if (!trialAllowed) {

        return sendJson(
          res,
          402,
          {
            error:
              "Your free anonymous generation has already been used. Please sign up or log in to continue.",

            creator:
              false
          }
        );
      }


      anonymousTrialConsumed =
        true;


      console.log(
        "QV37 anonymous trial consumed."
      );
    }


    /*
      ------------------------------------------------
      GEMINI
      ------------------------------------------------
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
        "QV37 Gemini generation failed:",
        geminiError
      );


      /*
        Refund normal user's credit.
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


      /*
        Refund anonymous trial.
      */

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


      /*
        Return Gemini error.
      */

      return sendJson(
        res,
        503,
        {
          error:
            geminiError &&
            geminiError.message
              ? geminiError.message
              : "The AI service is temporarily unavailable. Your credit has been refunded. Please try again.",

          creator:
            isCreator
        }
      );
    }


    /*
      ------------------------------------------------
      REMAINING CREDITS
      ------------------------------------------------
    */

    let remainingCredits =
      null;


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
              p_user_id:
                userId,

              p_trial_id:
                null
            }
          );


        remainingCredits =
          Number(
            remainingCredits
          );


      } catch (error) {

        console.error(
          "QV37 unable to read remaining credits:",
          error
        );


        remainingCredits =
          null;
      }
    }


    /*
      ------------------------------------------------
      SUCCESS
      ------------------------------------------------
    */

    console.log(
      "QV37 generation successful."
    );


    return sendJson(
      res,
      200,
      {
        success:
          true,

        html:
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


    /*
      ------------------------------------------------
      UNEXPECTED ERROR
      ------------------------------------------------
    */

    console.error(
      "QV37 generate handler error:",
      error
    );


    /*
      Refund normal user if necessary.
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


    /*
      Refund anonymous trial if necessary.
    */

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
