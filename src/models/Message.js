import mongoose from "mongoose";

// Contact-form / bridal-appointment enquiries.
export default mongoose.model(
  "Message",
  new mongoose.Schema(
    {
      type: { type: String, enum: ["contact", "bridal"], default: "contact" },
      name: { type: String, required: true },
      email: String,
      phone: String,
      date: Date,
      message: String,
      handled: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);
