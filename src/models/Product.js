import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    description: String,
    metal: String,
    weight: String, // e.g. "6.2 g"
    price: { type: Number, required: true, min: 0 }, // selling price
    compareAtPrice: { type: Number, min: 0 }, // original price, shown struck-through when higher than price
    stock: { type: Number, default: 0, min: 0 },
    sizes: [String],
    images: [String],
    tag: String, // "New", "Bestseller" ...
    tone: { type: String, enum: ["emerald", "rose", "night"], default: "emerald" },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sold: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

productSchema.virtual("discountPercent").get(function () {
  return this.compareAtPrice > this.price ? Math.round((1 - this.price / this.compareAtPrice) * 100) : 0;
});

productSchema.index({ name: "text", description: "text", metal: "text" });
productSchema.index({ category: 1, active: 1, price: 1 });

export default mongoose.model("Product", productSchema);
