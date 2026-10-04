import { Router } from "express";
import { z } from "zod";
import { protect, adminOnly } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { upload, saveFile, removeFile } from "../../middleware/upload.js";
import { AppError, notFound } from "../../utils/AppError.js";
import { uniqueSlug } from "../../utils/slugify.js";
import { crud } from "./crud.js";
import { buildProductFilter, paging } from "../catalog.js";
import { restock } from "../orders.js";
import Product from "../../models/Product.js";
import Category, { KINDS } from "../../models/Category.js";
import Coupon from "../../models/Coupon.js";
import Order, { ORDER_STATUSES } from "../../models/Order.js";
import User from "../../models/User.js";
import Review from "../../models/Review.js";
import Setting from "../../models/Setting.js";
import Subscriber from "../../models/Subscriber.js";
import Message from "../../models/Message.js";
import Slide from "../../models/Slide.js";

const r = Router();
r.use(protect, adminOnly);

const id = z.string().length(24);
const optDate = z.union([z.coerce.date(), z.null()]).optional();

/* ---------------- Dashboard ---------------- */
r.get("/stats", async (_req, res) => {
  const since = new Date(Date.now() - 30 * 864e5);
  const valid = { status: { $nin: ["cancelled", "returned"] } };
  const [totals, last30, byStatus, daily, top, lowStock, recent, customers, products] = await Promise.all([
    Order.aggregate([{ $match: valid }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { ...valid, createdAt: { $gte: since } } }, { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...valid, createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Product.find().sort({ sold: -1 }).limit(5).select("name slug sold price stock"),
    Product.find({ active: true, stock: { $lte: 3 } }).sort({ stock: 1 }).limit(10).select("name slug stock"),
    Order.find().sort({ createdAt: -1 }).limit(8).select("number shippingAddress.name total status createdAt"),
    User.countDocuments({ role: "customer" }),
    Product.countDocuments(),
  ]);
  res.json({
    revenue: totals[0]?.revenue || 0, orders: totals[0]?.orders || 0,
    revenue30: last30[0]?.revenue || 0, orders30: last30[0]?.orders || 0,
    customers, products,
    byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    daily, top, lowStock, recent,
  });
});

/* ---------------- Products ---------------- */
const productBase = {
  name: z.string().min(2).max(120), sku: z.string().max(40).optional(), category: id,
  description: z.string().max(5000).optional(), metal: z.string().max(120).optional(), weight: z.string().max(40).optional(),
  price: z.number().min(0), compareAtPrice: z.number().min(0).nullable().optional(), stock: z.number().int().min(0).optional(),
  sizes: z.array(z.string().max(20)).optional(), images: z.array(z.string().max(500)).optional(),
  tag: z.string().max(30).optional(), tone: z.enum(["emerald", "rose", "night"]).optional(),
  featured: z.boolean().optional(), active: z.boolean().optional(), slug: z.string().max(140).optional(),
};
const productCreate = z.object(productBase);
const productUpdate = productCreate.partial();

async function productBefore(body, doc) {
  if (body.category && !(await Category.exists({ _id: body.category }))) throw new AppError("Category not found");
  if (body.slug || body.name || !doc) body.slug = await uniqueSlug(Product, body.slug || body.name || doc.name, doc?._id);
  if (body.compareAtPrice === null) body.compareAtPrice = undefined;
  return body;
}

r.get("/products", async (req, res) => {
  const filter = await buildProductFilter(req.query, { admin: true });
  const { limit, page, skip } = paging(req.query, 200);
  const [items, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("category", "name slug kind"),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

/** Put a whole category (or chosen products) on sale, or end the sale. */
r.post(
  "/products/bulk-discount",
  validate(z.object({ category: id.optional(), products: z.array(id).optional(), percent: z.number().min(0).max(90) })),
  async (req, res) => {
    const { category, products, percent } = req.body;
    if (!category && !products?.length) throw new AppError("Choose a category or products");
    const list = await Product.find(category ? { category } : { _id: { $in: products } });
    for (const p of list) {
      const original = p.compareAtPrice > p.price ? p.compareAtPrice : p.price;
      if (percent === 0) (p.price = original), (p.compareAtPrice = undefined);
      else (p.compareAtPrice = original), (p.price = Math.round(original * (1 - percent / 100)));
      await p.save();
    }
    res.json({ updated: list.length });
  }
);

r.post(
  "/products/bulk",
  validate(z.object({ ids: z.array(id).min(1), action: z.enum(["activate", "deactivate", "feature", "unfeature", "delete"]) })),
  async (req, res) => {
    const { ids, action } = req.body;
    const set = { activate: { active: true }, deactivate: { active: false }, feature: { featured: true }, unfeature: { featured: false } }[action];
    const out = set ? await Product.updateMany({ _id: { $in: ids } }, set) : await Product.deleteMany({ _id: { $in: ids } });
    res.json({ updated: out.modifiedCount ?? out.deletedCount });
  }
);

r.use("/products", crud(Product, { create: productCreate, update: productUpdate, populate: "category", before: productBefore }));

/* ---------------- Categories ---------------- */
const catCreate = z.object({
  name: z.string().min(2).max(60), slug: z.string().max(80).optional(), kind: z.enum(KINDS).optional(),
  description: z.string().max(1000).optional(), image: z.string().max(500).optional(), sort: z.number().int().optional(), active: z.boolean().optional(),
});
r.use(
  "/categories",
  crud(Category, {
    create: catCreate, update: catCreate.partial(), search: ["name", "slug"], sort: { sort: 1, name: 1 },
    before: async (b, doc) => {
      if (b.slug || b.name || !doc) b.slug = await uniqueSlug(Category, b.slug || b.name || doc.name, doc?._id);
      return b;
    },
    beforeDelete: async (cid) => {
      const n = await Product.countDocuments({ category: cid });
      if (n) throw new AppError(`Move or delete the ${n} products in this category first`);
      return Category.findByIdAndDelete(cid);
    },
  })
);

/* ---------------- Coupons / discounts ---------------- */
const couponCreate = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  description: z.string().max(200).optional(), type: z.enum(["percent", "fixed"]), value: z.number().min(0),
  minOrder: z.number().min(0).optional(), maxDiscount: z.number().min(0).nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(), perUserLimit: z.number().int().min(1).nullable().optional(),
  categories: z.array(id).optional(), startsAt: optDate, expiresAt: optDate, active: z.boolean().optional(),
});
const couponCheck = (b) => {
  if (b.type === "percent" && b.value > 100) throw new AppError("Percent discount cannot be over 100");
  for (const k of Object.keys(b)) if (b[k] === null) b[k] = undefined;
  return b;
};
r.use("/coupons", crud(Coupon, { create: couponCreate, update: couponCreate.partial(), search: ["code", "description"], populate: "categories", before: couponCheck }));

/* ---------------- Orders ---------------- */
r.get("/orders", async (req, res) => {
  const f = {};
  if (req.query.status) f.status = req.query.status;
  if (req.query.payment) f.paymentStatus = req.query.payment;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    f.$or = [{ number: rx }, { email: rx }, { "shippingAddress.name": rx }, { "shippingAddress.phone": rx }];
  }
  if (req.query.from || req.query.to)
    f.createdAt = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(req.query.to) }) };
  const { limit, page, skip } = paging(req.query, 200);
  const [items, total] = await Promise.all([
    Order.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("user", "name email"),
    Order.countDocuments(f),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

r.get("/orders/:id", async (req, res) => {
  const item = await Order.findById(req.params.id).populate("user", "name email phone");
  if (!item) throw notFound("Order");
  res.json({ item });
});

r.patch(
  "/orders/:id",
  validate(z.object({
    status: z.enum(ORDER_STATUSES).optional(), paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
    trackingNumber: z.string().max(60).optional(), note: z.string().max(300).optional(),
  })),
  async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw notFound("Order");
    const { status, note, ...rest } = req.body;
    Object.assign(order, rest);
    if (status && status !== order.status) {
      const wasOut = !["cancelled", "returned"].includes(order.status);
      const nowOut = ["cancelled", "returned"].includes(status);
      if (wasOut && nowOut) await restock(order.items); // give stock back
      if (!wasOut && !nowOut) throw new AppError("A cancelled or returned order cannot be reopened");
      order.status = status;
      order.history.push({ status, note });
    } else if (note) order.history.push({ status: order.status, note });
    await order.save();
    res.json({ item: order });
  }
);

r.delete("/orders/:id", async (req, res) => {
  const order = await Order.findByIdAndDelete(req.params.id);
  if (!order) throw notFound("Order");
  if (!["cancelled", "returned"].includes(order.status)) await restock(order.items);
  res.json({ message: "Order deleted" });
});

/* ---------------- Customers & admins ---------------- */
r.post(
  "/users",
  validate(z.object({ name: z.string().min(2), email: z.email(), phone: z.string().optional(), password: z.string().min(6), role: z.enum(["customer", "admin"]).default("customer") })),
  async (req, res) => res.status(201).json({ item: await User.create(req.body) })
);
r.patch(
  "/users/:id",
  validate(z.object({ name: z.string().min(2).optional(), phone: z.string().optional(), role: z.enum(["customer", "admin"]).optional(), blocked: z.boolean().optional(), password: z.string().min(6).optional() })),
  async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw notFound("User");
    if (String(user._id) === String(req.user._id) && (req.body.role === "customer" || req.body.blocked))
      throw new AppError("You cannot demote or block yourself");
    Object.assign(user, req.body);
    await user.save();
    res.json({ item: user });
  }
);
r.get("/users/:id/orders", async (req, res) => res.json({ items: await Order.find({ user: req.params.id }).sort({ createdAt: -1 }) }));
r.use(
  "/users",
  crud(User, {
    search: ["name", "email", "phone"],
    filter: (q) => ({ ...(q.role && { role: q.role }), ...(q.blocked && { blocked: q.blocked === "true" }) }),
    beforeDelete: async (uid) => {
      const u = await User.findById(uid);
      if (u?.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) throw new AppError("Cannot delete the last admin");
      return User.findByIdAndDelete(uid);
    },
  })
);

/* ---------------- Reviews ---------------- */
r.use(
  "/reviews",
  crud(Review, {
    update: z.object({ approved: z.boolean() }), populate: [{ path: "product", select: "name slug" }],
    filter: (q) => ({ ...(q.approved && { approved: q.approved === "true" }), ...(q.product && { product: q.product }) }),
    after: (doc) => Review.syncProduct(doc.product),
    beforeDelete: async (rid) => {
      const rv = await Review.findByIdAndDelete(rid);
      if (rv) await Review.syncProduct(rv.product);
      return rv;
    },
  })
);

/* ---------------- Newsletter & messages ---------------- */
r.use("/subscribers", crud(Subscriber, { search: ["email"] }));
r.use("/messages", crud(Message, {
  update: z.object({ handled: z.boolean() }), search: ["name", "email", "phone"],
  filter: (q) => ({ ...(q.type && { type: q.type }), ...(q.handled && { handled: q.handled === "true" }) }),
}));

/* ---------------- Home carousel ---------------- */
const slideCreate = z.object({
  image: z.string().max(500).optional(), mobileImage: z.string().max(500).optional(), kicker: z.string().max(80).optional(),
  title: z.string().min(2).max(120), subtitle: z.string().max(300).optional(), ctaLabel: z.string().max(40).optional(),
  ctaLink: z.string().max(300).optional(), kind: z.enum(KINDS).optional(), tone: z.enum(["emerald", "rose", "sand"]).optional(),
  sort: z.number().int().optional(), active: z.boolean().optional(),
});
r.use("/slides", crud(Slide, { create: slideCreate, update: slideCreate.partial(), search: ["title", "kicker"], sort: { sort: 1, createdAt: 1 } }));

/* ---------------- Settings ---------------- */
r.get("/settings", async (_req, res) => res.json({ item: await Setting.get() }));
r.put(
  "/settings",
  validate(z.object({
    storeName: z.string().max(60), announcement: z.string().max(200), shippingFee: z.number().min(0), freeShippingOver: z.number().min(0),
    whatsapp: z.string().max(20), phone: z.string().max(30), email: z.string().max(80), address: z.string().max(200),
    bankDetails: z.string().max(500), codEnabled: z.boolean(), bankEnabled: z.boolean(),
  }).partial()),
  async (req, res) => {
    const s = await Setting.get();
    Object.assign(s, req.body);
    await s.save();
    res.json({ item: s });
  }
);

/* ---------------- Image upload ---------------- */
r.post("/upload", upload.array("images", 10), async (req, res) => {
  if (!req.files?.length) throw new AppError("No images received");
  res.status(201).json({ urls: await Promise.all(req.files.map(saveFile)) });
});
/** Body: { url } — the URL returned by POST /upload. */
r.delete("/upload", validate(z.object({ url: z.string().min(1) })), async (req, res) => {
  await removeFile(req.body.url).catch(() => { throw notFound("File"); });
  res.json({ message: "File deleted" });
});

export default r;
