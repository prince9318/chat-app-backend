import multer from "multer";

const storage = multer.memoryStorage();

export const uploadAttachment = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
