import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    password: {
      type: String,
      minlength: 6,
      required: function () {
        return this.authProvider === "local";
      },
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    providerId: { type: String },
    profilePic: { type: String, default: "" },
    bio: { type: String },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ authProvider: 1, providerId: 1 }, { sparse: true });

const User = mongoose.model("User", userSchema);

export default User;
