import express from "express";
import {
  checkAuth,
  forgotPassword,
  login,
  resetPassword,
  signup,
  updateProfile,
} from "../controllers/userController.js";
import { protectRoute } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, checkAuth);

export default userRouter;
