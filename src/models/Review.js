import mongoose from "mongoose";
import Product from "./Product.js";

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 1000 },
    approved: { type: Boolean, default: true },
  },
  { timestamps: true }
);
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

/** Recompute the product's average rating from approved reviews. */
reviewSchema.statics.syncProduct = async function (productId) {
  const [s] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), approved: true } },
    { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } },
  ]);
  await Product.findByIdAndUpdate(productId, { rating: s ? Math.round(s.avg * 10) / 10 : 0, reviewCount: s?.n || 0 });
};

export default mongoose.model("Review", reviewSchema);
