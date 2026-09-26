import express from "express";
import {
  checkAuth,
  forgotPassword,
  login,
  resendVerificationEmail,
  resetPassword,
  signup,
  updateProfile,
  verifyEmail,
} from "../controllers/userController.js";
import { protectRoute } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.post("/verify-email", verifyEmail);
userRouter.post("/resend-verification-email", resendVerificationEmail);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, checkAuth);

export default userRouter;
