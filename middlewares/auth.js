import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { TOKEN_COOKIE_NAME } from "../lib/utils.js";

const extractToken = (req) => {
  const fromHeader = req.headers?.token || req.headers?.authorization?.replace(/^Bearer\s+/i, "");
  if (fromHeader) return fromHeader;
  const fromCookie = req.cookies?.[TOKEN_COOKIE_NAME];
  if (fromCookie) return fromCookie;
  return null;
};

export const protectRoute = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) return res.json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
