import express from "express";
import {
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
} from "../controllers/oauthController.js";

const oauthRouter = express.Router();

oauthRouter.get("/google", googleAuth);
oauthRouter.get("/google/callback", googleCallback);
oauthRouter.get("/github", githubAuth);
oauthRouter.get("/github/callback", githubCallback);

export default oauthRouter;
