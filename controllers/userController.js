import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import crypto from "crypto";
import {
  canSendMail,
  getMailProvider,
  sendPasswordResetEmail,
} from "../lib/mailer.js";

const isLocalUrl = (value = "") =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(value).trim());

const canExposeResetUrl = (frontendBase) =>
  process.env.ALLOW_RESET_LINK_FALLBACK === "true" ||
  (process.env.NODE_ENV !== "production" && isLocalUrl(frontendBase));

// Signup a new user
export const signup = async (req, res) => {
  const { fullName, email, password, bio } = req.body;

  try {
    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, message: "Missing Details" });
    }
    const user = await User.findOne({ email });

    if (user) {
      return res.json({ success: false, message: "Account already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      bio,
      authProvider: "local",
    });

    const token = generateToken(newUser._id);

    res.json({
      success: true,
      userData: newUser,
      token,
      message: "Account created successfully",
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Controller to login a user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const userData = await User.findOne({ email });

    if (!userData) {
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (userData.authProvider !== "local") {
      const providerLabel =
        userData.authProvider === "google" ? "Google" : "GitHub";
      return res.json({
        success: false,
        message: `This account uses ${providerLabel} sign-in. Please continue with ${providerLabel}.`,
      });
    }

    if (!userData.password) {
      return res.json({
        success: false,
        message: "Please sign in with your linked social account.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, userData.password);

    if (!isPasswordCorrect) {
      return res.json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(userData._id);

    res.json({ success: true, userData, token, message: "Login successful" });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
// Controller to check if user is authenticated
export const checkAuth = (req, res) => {
  res.json({ success: true, user: req.user });
};

// Controller to update user profile details
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName } = req.body;

    const userId = req.user._id;
    let updatedUser;

    if (!profilePic) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { bio, fullName },
        { new: true }
      );
    } else {
      const upload = await cloudinary.uploader.upload(profilePic);

      updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePic: upload.secure_url, bio, fullName },
        { new: true }
      );
    }
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Request password reset (email-based reset link)
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });

    // Always return success to avoid account enumeration
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists for that email, a reset link was sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordTokenHash = resetTokenHash;
    user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    const frontendBase =
      process.env.FRONTEND_URL || process.env.OAUTH_SUCCESS_REDIRECT || "";
    const resetUrl = `${String(frontendBase).replace(/\/$/, "")}/reset-password?token=${resetToken}&email=${encodeURIComponent(
      email
    )}`;
    const allowResetUrlFallback = canExposeResetUrl(frontendBase);

    if (canSendMail()) {
      try {
        await sendPasswordResetEmail({ to: email, resetUrl });
        return res.json({
          success: true,
          message: "If an account exists for that email, a reset link was sent.",
        });
      } catch (mailError) {
        console.error("Password reset email failed", {
          provider: mailError?.mailProvider || getMailProvider(),
          message: mailError?.message,
          code: mailError?.smtpCode || mailError?.code || null,
          command: mailError?.smtpCommand || null,
          response: mailError?.smtpResponse || null,
          httpStatus: mailError?.httpStatus || null,
          frontendBase,
          email,
        });

        if (allowResetUrlFallback) {
          return res.json({
            success: true,
            message:
              "Email service is unavailable, so a reset link is shown below for local testing.",
            resetUrl,
          });
        }

        return res.json({
          success: false,
          message:
            "We could not send the reset email right now. Please try again in a moment.",
        });
      }
    }

    if (allowResetUrlFallback) {
      return res.json({
        success: true,
        message:
          "Password reset link generated (email provider not configured). Use the provided URL to reset.",
        resetUrl,
      });
    }

    return res.json({
      success: false,
      message:
        "Password reset email is not configured on the server. Please contact support.",
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Reset password using token
export const resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password) {
      return res.json({ success: false, message: "Missing details" });
    }
    if (String(password).length < 6) {
      return res.json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      email,
      resetPasswordTokenHash: resetTokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully. Please log in.",
    });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
