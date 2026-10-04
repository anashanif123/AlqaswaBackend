import mongoose from "mongoose";

mongoose.set("strictQuery", true);
let pending = null;

/** Connects once and reuses the connection (important on Vercel, where each request may hit a warm function). */
export function connectDB(uri = process.env.MONGO_URI) {
  if (mongoose.connection.readyState === 1) return Promise.resolve();
  if (!uri) throw new Error("MONGO_URI is missing");
  pending ??= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log("MongoDB connected"))
    .catch((e) => { pending = null; throw e; });
  return pending;
}
