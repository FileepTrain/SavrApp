import multer from "multer";

// Optional middleware to upload a single image for recipe creation if provided in the request (memory storage for Firebase upload)
export const uploadRecipeImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB upload limit
}).single("image");
