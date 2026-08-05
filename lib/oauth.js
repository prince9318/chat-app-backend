import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateToken } from "./utils.js";

const getSecret = () => process.env.SESSION_SECRET || process.env.JWT_SECRET;

export const getBackendUrl = () => process.env.BACKEND_URL.replace(/\/$/, "");

export const getFrontendUrl = () =>
  process.env.OAUTH_SUCCESS_REDIRECT.replace(/\/$/, "");

export const createOAuthState = (provider) =>
  jwt.sign(
    { provider, nonce: crypto.randomBytes(16).toString("hex") },
    getSecret(),
    { expiresIn: "10m" },
  );

export const verifyOAuthState = (state, expectedProvider) => {
  try {
    const decoded = jwt.verify(state, getSecret());
    if (decoded.provider !== expectedProvider) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const redirectWithError = (res, message) => {
  res.redirect(
    `${getFrontendUrl()}/auth/callback?error=${encodeURIComponent(message)}`,
  );
};

export const redirectWithToken = (res, token) => {
  res.redirect(
    `${getFrontendUrl()}/auth/callback?token=${encodeURIComponent(token)}`,
  );
};

export const findOrCreateOAuthUser = async ({
  provider,
  providerId,
  email,
  fullName,
  profilePic,
}) => {
  if (!email) {
    throw new Error(
      "Could not retrieve email from your account. Please try another method.",
    );
  }

  let user = await User.findOne({ authProvider: provider, providerId });
  if (user) {
    if (profilePic && !user.profilePic) {
      user.profilePic = profilePic;
      await user.save();
    }
    return user;
  }

  user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    if (user.authProvider === "local" && user.password) {
      throw new Error(
        "An account with this email already exists. Please log in with your password.",
      );
    }
    if (user.authProvider !== provider && user.providerId) {
      throw new Error(
        "An account with this email already exists with a different sign-in method.",
      );
    }
    user.authProvider = provider;
    user.providerId = providerId;
    if (profilePic && !user.profilePic) user.profilePic = profilePic;
    if (fullName && !user.fullName) user.fullName = fullName;
    await user.save();
    return user;
  }

  return User.create({
    email: email.toLowerCase(),
    fullName: fullName || email.split("@")[0],
    authProvider: provider,
    providerId,
    profilePic: profilePic || "",
    bio: "",
  });
};

export const issueOAuthToken = (user) => generateToken(user._id);
