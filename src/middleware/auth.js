import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "7d" });

async function readUser(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  try {
    const { id } = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    const user = await User.findById(id);
    return user && !user.blocked ? user : null;
  } catch {
    return null;
  }
}

/** Requires a logged-in user. */
export async function protect(req, _res, next) {
  req.user = await readUser(req);
  if (!req.user) throw new AppError("Please log in", 401);
  next();
}

/** Attaches the user when a valid token is sent, but never blocks. */
export async function optionalAuth(req, _res, next) {
  req.user = await readUser(req);
  next();
}

export function adminOnly(req, _res, next) {
  if (req.user?.role !== "admin") throw new AppError("Admins only", 403);
  next();
}
