import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { put, del } from "@vercel/blob";
import { AppError } from "../utils/AppError.js";

export const UPLOAD_DIR = path.resolve("uploads");
// On Vercel the disk is read-only, so photos go to Vercel Blob when its token is set; locally they go to ./uploads.
export const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 10 }, // Vercel caps request bodies at 4.5 MB
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError("Only image files are allowed")),
});

/** Stores an uploaded file and returns its public URL. */
export async function saveFile(file) {
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`;
  if (useBlob()) return (await put(`products/${name}`, file.buffer, { access: "public", contentType: file.mimetype })).url;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return `/uploads/${name}`;
}

export async function removeFile(url) {
  if (/^https?:/.test(url)) return useBlob() && del(url);
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(url)));
}
