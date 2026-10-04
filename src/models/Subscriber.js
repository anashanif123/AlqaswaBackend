import mongoose from "mongoose";

export default mongoose.model(
  "Subscriber",
  new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true } }, { timestamps: true })
);
