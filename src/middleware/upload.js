import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { AppError } from "../utils/AppError.js";

export const UPLOAD_DIR = path.resolve("uploads");

// Photos go to Cloudinary when its keys are set (needed on Vercel, whose disk is read-only); otherwise to ./uploads locally.
const cloud = () => {
  const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  return name && key && secret ? { name, key, secret } : null;
};
const FOLDER = process.env.CLOUDINARY_FOLDER || "alqaswa/products";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 10 }, // Vercel caps request bodies at 4.5 MB
  fileFilter: (_req, file, cb) =>
    /^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError("Only image files are allowed")),
});

/** Signed call to Cloudinary's image API. `file` is sent but not signed; other params are signed in alphabetical order. */
async function cloudinary(action, params, file) {
  const c = cloud();
  const signed = { ...params, timestamp: Math.floor(Date.now() / 1000) };
  const toSign = Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join("&");
  const body = new FormData();
  for (const [k, v] of Object.entries(signed)) body.append(k, String(v));
  if (file) body.append("file", file);
  body.append("api_key", c.key);
  body.append("signature", crypto.createHash("sha1").update(toSign + c.secret).digest("hex"));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.name}/image/${action}`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AppError(`Image service: ${data.error?.message || res.status}`, 502);
  return data;
}

/** Stores an uploaded file and returns its public URL. */
export async function saveFile(file) {
  if (cloud()) {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    return (await cloudinary("upload", { folder: FOLDER }, dataUri)).secure_url;
  }
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
  return `/uploads/${name}`;
}

export async function removeFile(url) {
  if (/res\.cloudinary\.com/.test(url)) {
    // https://res.cloudinary.com/<cloud>/image/upload/v123/alqaswa/products/abc.jpg -> alqaswa/products/abc
    const publicId = url.split("/upload/")[1]?.replace(/^([^/]+,[^/]*\/)?v\d+\//, "").replace(/\.[a-z0-9]+$/i, "");
    if (cloud() && publicId) await cloudinary("destroy", { public_id: publicId });
    return;
  }
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(url)));
}
