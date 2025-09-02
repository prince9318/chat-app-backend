import express from "express";
import { protectRoute } from "../middlewares/auth.js";

import {
  getMessages,
  getUsersForSidebar,
  markMessageAsSeen,
  sendMessage,
  deleteMessage,
} from "../controllers/messageController.js";
import Message from "../models/Message.js";
import { uploadAudio } from "../middlewares/uploadAudio.js";
import { io } from "../server.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessageAsSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage);
messageRouter.delete("/delete/:messageId", protectRoute, deleteMessage);

// ✅ New: Send audio message
messageRouter.post(
  "/send-audio/:id",
  protectRoute,
  uploadAudio.single("audio"),
  async (req, res) => {
    try {
      const senderId = req.user._id; // comes from protectRoute middleware
      const receiverId = req.params.id; // target userId from URL

      if (!req.file || !req.file.path) {
        return res
          .status(400)
          .json({ success: false, message: "No audio file uploaded" });
      }

      const newMessage = new Message({
        senderId,
        receiverId,
        audio: req.file.path, // Cloudinary secure URL
      });

      await newMessage.save();

      // ✅ emit real-time event to receiver
      io.to(receiverId.toString()).emit("newMessage", newMessage);

      res.json({
        success: true,
        message: "Audio sent successfully",
        data: newMessage,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Error sending audio message" });
    }
  }
);

export default messageRouter;
