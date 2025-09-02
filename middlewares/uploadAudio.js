import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chat-app/audio", // all audio files will be stored here
    resource_type: "auto", // supports audio, video, images
    format: async (req, file) => {
      if (file.mimetype.startsWith("audio/")) return "mp3"; // convert to mp3
      return undefined;
    },
    public_id: (req, file) => `${Date.now()}-${file.originalname}`,
  },
});

export const uploadAudio = multer({ storage });
