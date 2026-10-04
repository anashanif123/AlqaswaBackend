import mongoose from "mongoose";

export const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    slug: String,
    image: String,
    kind: String,
    size: String,
    price: Number,
    qty: { type: Number, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    number: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: { type: String, lowercase: true, trim: true },
    items: [itemSchema],
    shippingAddress: { name: String, phone: String, line1: String, line2: String, city: String, province: String, postalCode: String },
    note: String,
    subtotal: Number,
    discount: { type: Number, default: 0 },
    couponCode: String,
    shipping: { type: Number, default: 0 },
    total: Number,
    paymentMethod: { type: String, enum: ["cod", "bank"], default: "cod" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    trackingNumber: String,
    history: [{ status: String, note: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);

orderSchema.pre("validate", async function () {
  if (this.number) return;
  const last = await this.constructor.findOne({}, { number: 1 }).sort({ createdAt: -1 });
  const n = last?.number ? parseInt(last.number.split("-")[1], 10) + 1 : 10001;
  this.number = `AQ-${n}`;
});

export default mongoose.model("Order", orderSchema);
