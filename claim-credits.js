export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return res.status(500).json({
      error:
        "Supabase environment variables are not configured in Vercel."
    });
  }

  try {
    /*
      GET LOGIN TOKEN
    */

    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Please log in first."
      });
    }

    const accessToken =
      authHeader.substring(7);


    /*
      VERIFY THE LOGGED-IN USER
    */

    const userResponse =
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


    if (!userResponse.ok) {

      return res.status(401).json({
        error:
          "Your login session is invalid or expired."
      });

    }


    const user =
      await userResponse.json();


    if (!user || !user.id) {

      return res.status(401).json({
        error:
          "Unable to identify your account."
      });

    }


    /*
      GET ANONYMOUS TRIAL COOKIE
    */

    const cookieHeader =
      req.headers.cookie || "";

    let trialId = null;

    const cookies =
      cookieHeader
        .split(";")
        .map(c => c.trim());


    for (const cookie of cookies) {

      if (
        cookie.startsWith(
          "qv37_trial_id="
        )
      ) {

        trialId =
          decodeURIComponent(
            cookie.substring(
              "qv37_trial_id=".length
            )
          );

        break;

      }

    }


    /*
      CREATE / FIND USER CREDIT ACCOUNT
    */

    const rpcResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/ensure_user_credits`,
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

          body: JSON.stringify({
            p_user_id: user.id,

            p_trial_id: trialId
          })
        }
      );


    if (!rpcResponse.ok) {

      const errorText =
        await rpcResponse.text();

      console.error(
        "Credit RPC error:",
        errorText
      );

      return res.status(500).json({
        error:
          "Unable to create your credit account."
      });

    }


    const balance =
      await rpcResponse.json();


    return res.status(200).json({
      success: true,
      credits: Number(balance)
    });


  } catch (error) {

    console.error(
      "Claim credits error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to connect to the credit system."
    });

  }
}
