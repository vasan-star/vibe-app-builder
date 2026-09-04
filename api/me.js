function sendJson(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.end(JSON.stringify(data));
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

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return sendJson(res, 405, {
      error: "Method not allowed."
    });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  const creatorEmail =
    (process.env.CREATOR_EMAIL || "")
      .trim()
      .toLowerCase();

  if (!supabaseUrl || !supabaseSecretKey) {
    return sendJson(res, 500, {
      error: "Server configuration is incomplete."
    });
  }

  try {

    const authHeader =
      req.headers.authorization || "";

    let accessToken = null;

    if (authHeader.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    }

    const user =
      await getLoggedInUser(
        supabaseUrl,
        supabaseSecretKey,
        accessToken
      );

    if (!user) {
      return sendJson(res, 200, {
        loggedIn: false,
        creator: false
      });
    }

    const email =
      (user.email || "")
        .trim()
        .toLowerCase();

    const isCreator =
      Boolean(
        creatorEmail &&
        email === creatorEmail
      );

    return sendJson(res, 200, {
      loggedIn: true,
      creator: isCreator
    });

  } catch (error) {

    console.error(
      "QV37 /api/me error:",
      error
    );

    return sendJson(res, 500, {
      error: "Unable to check account."
    });
  }
}
