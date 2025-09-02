import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    audio: { type: String }, // ✅ new field for audio file URL
    text: { type: String },
    image: { type: String },
    video: { type: String }, // ✅ new field for video file URL
    seen: { type: Boolean, default: false },
    // 👇 Add soft delete field
    isDeleted: { type: Boolean, default: false },
    // Track which users have deleted the message for themselves
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
