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
    messageType: { type: String, default: "text" }, // 'text' | 'call'
    callType: { type: String }, // 'audio' | 'video' (when messageType === 'call')
    callStatus: { type: String }, // 'answered' | 'missed' (when messageType === 'call')
    callDuration: { type: Number, default: 0 }, // seconds (when messageType === 'call')
    audio: { type: String },
    text: { type: String },
    image: { type: String },
    video: { type: String },
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
