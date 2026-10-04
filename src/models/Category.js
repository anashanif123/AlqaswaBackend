import mongoose from "mongoose";

// `kind` picks the line-art icon on the storefront when there is no image.
export const KINDS = ["ring", "necklace", "earring", "bangle", "pendant"];

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    kind: { type: String, enum: KINDS, default: "ring" },
    description: String,
    image: String,
    sort: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
