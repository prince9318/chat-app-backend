import {
  createOAuthState,
  verifyOAuthState,
  getBackendUrl,
  redirectWithError,
  redirectWithToken,
  findOrCreateOAuthUser,
  issueOAuthToken,
} from "../lib/oauth.js";

const googleConfig = (req) => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${getBackendUrl(req)}/api/auth/google/callback`,
});

const githubConfig = (req) => ({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  redirectUri: `${getBackendUrl(req)}/api/auth/github/callback`,
});

const isConfigured = (config) =>
  Boolean(config.clientId && config.clientSecret);

// ---- Google OAuth ----

export const googleAuth = (req, res) => {
  const config = googleConfig(req);
  if (!isConfigured(config)) {
    return res.status(503).json({
      success: false,
      message: "Google sign-in is not configured on the server.",
    });
  }

  const state = createOAuthState("google");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

export const googleCallback = async (req, res) => {
  const config = googleConfig(req);
  const { code, state, error } = req.query;

  if (!isConfigured(config)) {
    return redirectWithError(
      res,
      "Google sign-in is not configured on the server.",
    );
  }

  if (error) {
    return redirectWithError(res, "Google sign-in was cancelled.");
  }

  if (!code || !state || !verifyOAuthState(state, "google")) {
    return redirectWithError(res, "Invalid or expired Google sign-in session.");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return redirectWithError(res, "Failed to authenticate with Google.");
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.email) {
      return redirectWithError(res, "Could not retrieve your Google profile.");
    }

    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerId: profile.id,
      email: profile.email,
      fullName: profile.name,
      profilePic: profile.picture,
    });

    return redirectWithToken(res, issueOAuthToken(user));
  } catch (err) {
    console.error("Google OAuth error:", err.message);
    return redirectWithError(res, err.message || "Google sign-in failed.");
  }
};

// ---- GitHub OAuth ----

export const githubAuth = (req, res) => {
  const config = githubConfig(req);
  if (!isConfigured(config)) {
    return res.status(503).json({
      success: false,
      message: "GitHub sign-in is not configured on the server.",
    });
  }

  const state = createOAuthState("github");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "user:email",
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

export const githubCallback = async (req, res) => {
  const config = githubConfig(req);
  const { code, state, error } = req.query;

  if (!isConfigured(config)) {
    return redirectWithError(
      res,
      "GitHub sign-in is not configured on the server.",
    );
  }

  if (error) {
    return redirectWithError(res, "GitHub sign-in was cancelled.");
  }

  if (!code || !state || !verifyOAuthState(state, "github")) {
    return redirectWithError(res, "Invalid or expired GitHub sign-in session.");
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      },
    );

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("GitHub token exchange failed:", tokenData);
      return redirectWithError(res, "Failed to authenticate with GitHub.");
    }

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "chat-app-oauth",
    };

    const profileRes = await fetch("https://api.github.com/user", { headers });
    const profile = await profileRes.json();

    if (!profileRes.ok) {
      return redirectWithError(res, "Could not retrieve your GitHub profile.");
    }

    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers,
      });
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary?.email || emails.find((e) => e.verified)?.email;
      }
    }

    const user = await findOrCreateOAuthUser({
      provider: "github",
      providerId: String(profile.id),
      email,
      fullName: profile.name || profile.login,
      profilePic: profile.avatar_url,
    });

    return redirectWithToken(res, issueOAuthToken(user));
  } catch (err) {
    console.error("GitHub OAuth error:", err.message);
    return redirectWithError(res, err.message || "GitHub sign-in failed.");
  }
};
