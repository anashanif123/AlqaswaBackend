import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "../utils/AppError.js";

export const UPLOAD_DIR = path.resolve("uploads");

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError("Only image files are allowed")),
});
