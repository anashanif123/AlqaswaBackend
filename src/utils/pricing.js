import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";
import Setting from "../models/Setting.js";
import { AppError } from "./AppError.js";

/** Checks a coupon against a cart and returns the discount amount (throws when not usable). */
export async function applyCoupon(code, lines, subtotal, userId) {
  const c = await Coupon.findOne({ code: code.toUpperCase().trim(), active: true });
  const now = new Date();
  if (!c || (c.startsAt && c.startsAt > now)) throw new AppError("This code is not valid");
  if (c.expiresAt && c.expiresAt < now) throw new AppError("This code has expired");
  if (c.usageLimit && c.used >= c.usageLimit) throw new AppError("This code has been fully used");
  if (subtotal < c.minOrder) throw new AppError(`Spend Rs ${c.minOrder.toLocaleString("en-PK")} or more to use this code`);
  if (c.perUserLimit && userId) {
    const n = await Order.countDocuments({ user: userId, couponCode: c.code, status: { $ne: "cancelled" } });
    if (n >= c.perUserLimit) throw new AppError("You have already used this code");
  }

  // Coupon may be limited to some categories
  const allowed = c.categories.map(String);
  const base = allowed.length
    ? lines.filter((l) => allowed.includes(String(l.category))).reduce((s, l) => s + l.price * l.qty, 0)
    : subtotal;
  if (!base) throw new AppError("This code does not apply to the items in your bag");

  let discount = c.type === "percent" ? (base * c.value) / 100 : c.value;
  if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  return { coupon: c, discount: Math.round(Math.min(discount, base)) };
}

/**
 * Prices a cart from the database (never trusts client prices).
 * items: [{ product: id, qty, size? }]
 */
export async function quoteCart(items, couponCode, userId) {
  if (!items?.length) throw new AppError("Your bag is empty");
  const products = await Product.find({ _id: { $in: items.map((i) => i.product) }, active: true }).populate("category", "kind");
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = items.map((i) => {
    const p = byId.get(String(i.product));
    if (!p) throw new AppError("An item in your bag is no longer available");
    if (p.stock < i.qty) throw new AppError(`Only ${p.stock} left of ${p.name}`);
    return {
      product: p._id, name: p.name, slug: p.slug, image: p.images[0], kind: p.category?.kind,
      size: i.size, price: p.price, qty: i.qty, category: p.category?._id,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const settings = await Setting.get();
  let discount = 0, coupon = null;
  if (couponCode) ({ discount, coupon } = await applyCoupon(couponCode, lines, subtotal, userId));

  const afterDiscount = subtotal - discount;
  const shipping = settings.freeShippingOver && afterDiscount >= settings.freeShippingOver ? 0 : settings.shippingFee;

  return { lines, subtotal, discount, coupon, shipping, total: afterDiscount + shipping, settings };
}
