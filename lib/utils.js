import jwt from "jsonwebtoken";

export const TOKEN_COOKIE_NAME = "auth_token";
export const TOKEN_EXPIRY_DAYS = 7;

export const generateToken = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: `${TOKEN_EXPIRY_DAYS}d`,
  });
  return token;
};

export const isProduction = () => process.env.NODE_ENV === "production";

export const setAuthCookie = (res, token) => {
  const maxAgeMs = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    maxAge: maxAgeMs,
    path: "/",
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
  });
};
