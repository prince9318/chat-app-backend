import Message from "../models/Message.js";
import User from "../models/User.js";
import { io, userSocketMap } from "../server.js";
import cloudinary from "../lib/cloudinary.js";

// Get all users except the logged in user
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );

    // Count number of messages not seen
    const unseenMessages = {};
    const promises = filteredUsers.map(async (user) => {
      const messages = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      if (messages.length > 0) {
        unseenMessages[user._id] = messages.length;
      }
    });
    await Promise.all(promises);
    res.json({ success: true, users: filteredUsers, unseenMessages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Get all messages for selected user
export const getMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });
    await Message.updateMany(
      { senderId: selectedUserId, receiverId: myId },
      { seen: true }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// api to mark message as seen using message id
export const markMessageAsSeen = async (req, res) => {
  try {
    const { id } = req.params;
    await Message.findByIdAndUpdate(id, { seen: true });
    res.json({ success: true });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Delete message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor } = req.body; // 'me' or 'everyone'
    const userId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.json({ success: false, message: "Message not found" });
    }

    // Check if user is authorized to delete this message
    if (
      deleteFor === "everyone" &&
      message.senderId.toString() !== userId.toString()
    ) {
      return res.json({
        success: false,
        message: "You can only delete your own messages for everyone",
      });
    }

    if (deleteFor === "everyone") {
      // Delete for everyone - update the message
      await Message.findByIdAndUpdate(messageId, { isDeleted: true });

      // Notify the other user about message deletion
      const receiverId =
        message.senderId.toString() === userId.toString()
          ? message.receiverId
          : message.senderId;

      // Use the imported io instance instead of global.io
      if (io) {
        io.emit("messageDeleted", { messageId });
      }

      return res.json({
        success: true,
        message: "Message deleted for everyone",
      });
    } else {
      // Delete for me only - add to user's deleted messages
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId },
      });

      return res.json({ success: true, message: "Message deleted for you" });
    }
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Save call log (visible to both users in chat)
export const saveCallLog = async (req, res) => {
  try {
    const myId = req.user._id;
    const { otherUserId, callType, callStatus, callDuration, wasCaller } = req.body;

    if (!otherUserId || !callType || !callStatus) {
      return res.status(400).json({
        success: false,
        message: "otherUserId, callType and callStatus are required",
      });
    }

    const senderId = wasCaller ? myId : otherUserId;
    const receiverId = wasCaller ? otherUserId : myId;

    const newMessage = await Message.create({
      senderId,
      receiverId,
      messageType: "call",
      callType: callType === "video" ? "video" : "audio",
      callStatus: callStatus === "answered" ? "answered" : "missed",
      callDuration: Math.max(0, Number(callDuration) || 0),
      seen: true,
    });

    // Emit only to the OTHER user (who didn't create this log) so they get it in real time.
    // The requester already gets the message from the API response and addCallLogMessage.
    const recipientUserId = senderId.toString() === myId.toString() ? receiverId : senderId;
    const otherSocketId = userSocketMap[recipientUserId.toString()];
    if (otherSocketId && io) {
      io.to(otherSocketId).emit("newMessage", newMessage);
    }

    res.json({ success: true, newMessage });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};

// Send message to selected user
export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, video } = req.body;
    const receiverId = req.params.id;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, {
        resource_type: "auto",
      });
      audioUrl = uploadResponse.secure_url;
    }

    let videoUrl;
    if (video) {
      const uploadResponse = await cloudinary.uploader.upload(video, {
        resource_type: "video",
        chunk_size: 6000000, // 6MB chunks for better upload performance
      });
      videoUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      video: videoUrl,
    });

    // Emit the new message to the receiver's socket
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.json({ success: true, newMessage });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
