import { Router } from "express";
import { z } from "zod";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import { optionalAuth, protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { quoteCart } from "../utils/pricing.js";
import { AppError, notFound } from "../utils/AppError.js";

const r = Router();

const cartItems = z.array(z.object({ product: z.string().length(24), qty: z.number().int().min(1).max(20), size: z.string().max(20).optional() })).min(1).max(50);

const publicQuote = (q) => ({
  lines: q.lines.map(({ category, ...l }) => l),
  subtotal: q.subtotal, discount: q.discount, couponCode: q.coupon?.code ?? null,
  shipping: q.shipping, total: q.total, freeShippingOver: q.settings.freeShippingOver,
});

/** Prices a bag and optionally checks a coupon code. */
r.post("/cart/quote", optionalAuth, validate(z.object({ items: cartItems, coupon: z.string().max(40).optional() })), async (req, res) => {
  const q = await quoteCart(req.body.items, req.body.coupon, req.user?._id);
  res.json(publicQuote(q));
});

/** Restores stock taken by an order (used on cancel / failed placement). */
export async function restock(lines) {
  await Promise.all(lines.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.qty, sold: -l.qty } })));
}

const placeSchema = z.object({
  items: cartItems,
  coupon: z.string().max(40).optional(),
  email: z.email().optional(),
  paymentMethod: z.enum(["cod", "bank"]).default("cod"),
  note: z.string().max(500).optional(),
  shippingAddress: z.object({
    name: z.string().min(2), phone: z.string().min(7).max(20), line1: z.string().min(3), line2: z.string().optional(),
    city: z.string().min(2), province: z.string().optional(), postalCode: z.string().optional(),
  }),
});

r.post("/orders", optionalAuth, validate(placeSchema), async (req, res) => {
  const b = req.body;
  const q = await quoteCart(b.items, b.coupon, req.user?._id);
  if (b.paymentMethod === "cod" && !q.settings.codEnabled) throw new AppError("Cash on delivery is not available right now");
  if (b.paymentMethod === "bank" && !q.settings.bankEnabled) throw new AppError("Bank transfer is not available right now");

  // Reserve stock atomically; roll back what was taken if any line fails.
  const taken = [];
  for (const l of q.lines) {
    const ok = await Product.updateOne({ _id: l.product, stock: { $gte: l.qty } }, { $inc: { stock: -l.qty, sold: l.qty } });
    if (!ok.modifiedCount) {
      await restock(taken);
      throw new AppError(`${l.name} just sold out`);
    }
    taken.push(l);
  }

  try {
    const order = await Order.create({
      user: req.user?._id,
      email: b.email || req.user?.email,
      items: q.lines,
      shippingAddress: b.shippingAddress,
      note: b.note,
      subtotal: q.subtotal, discount: q.discount, couponCode: q.coupon?.code, shipping: q.shipping, total: q.total,
      paymentMethod: b.paymentMethod,
      history: [{ status: "pending", note: "Order placed" }],
    });
    if (q.coupon) await Coupon.updateOne({ _id: q.coupon._id }, { $inc: { used: 1 } });
    res.status(201).json({ order });
  } catch (e) {
    await restock(taken);
    throw e;
  }
});

r.get("/orders/mine", protect, async (req, res) => {
  const items = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ items });
});

/** Order lookup: owner/admin by number, or anyone with number + matching phone (order tracking). */
r.get("/orders/:number", optionalAuth, async (req, res) => {
  const order = await Order.findOne({ number: req.params.number.toUpperCase() });
  if (!order) throw notFound("Order");
  const digits = (s = "") => s.replace(/\D/g, "").slice(-10);
  const owner = req.user && (req.user.role === "admin" || String(order.user) === String(req.user._id));
  const phoneMatch = req.query.phone && digits(String(req.query.phone)) === digits(order.shippingAddress.phone);
  if (!owner && !phoneMatch) throw notFound("Order");
  res.json({ order });
});

r.post("/orders/:number/cancel", protect, async (req, res) => {
  const order = await Order.findOne({ number: req.params.number.toUpperCase(), user: req.user._id });
  if (!order) throw notFound("Order");
  if (!["pending", "confirmed"].includes(order.status)) throw new AppError("This order can no longer be cancelled");
  order.status = "cancelled";
  order.history.push({ status: "cancelled", note: "Cancelled by customer" });
  await order.save();
  await restock(order.items);
  res.json({ order });
});

export default r;
