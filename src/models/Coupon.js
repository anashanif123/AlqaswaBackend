import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0 },
    maxDiscount: Number, // cap for percent coupons
    usageLimit: Number, // total uses allowed, empty = unlimited
    perUserLimit: Number,
    used: { type: Number, default: 0 },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }], // empty = whole cart
    startsAt: Date,
    expiresAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Coupon", couponSchema);
