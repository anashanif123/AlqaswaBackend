import { Router } from "express";
import { z } from "zod";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { notFound } from "../utils/AppError.js";

const r = Router();

const SORTS = { new: { createdAt: -1 }, "price-asc": { price: 1 }, "price-desc": { price: -1 }, popular: { sold: -1 }, rating: { rating: -1 } };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shared product query builder (used by the storefront and admin). */
export async function buildProductFilter(q, { admin = false } = {}) {
  const f = admin ? {} : { active: true };
  if (q.q) f.$or = [{ name: new RegExp(esc(String(q.q)), "i") }, { metal: new RegExp(esc(String(q.q)), "i") }, { sku: new RegExp(esc(String(q.q)), "i") }];
  if (q.category) {
    const cat = await Category.findOne({ $or: [{ slug: String(q.category) }, { kind: String(q.category) }] });
    f.category = cat?._id ?? null;
  }
  if (q.min || q.max) f.price = { ...(q.min && { $gte: +q.min }), ...(q.max && { $lte: +q.max }) };
  if (q.ids) f._id = { $in: String(q.ids).split(",").filter((x) => /^[a-f0-9]{24}$/.test(x)).slice(0, 100) };
  if (q.featured === "true") f.featured = true;
  if (q.sale === "true") f.$expr = { $gt: ["$compareAtPrice", "$price"] };
  if (q.inStock === "true") f.stock = { $gt: 0 };
  if (admin && q.active) f.active = q.active === "true";
  if (admin && q.lowStock === "true") f.stock = { $lte: 3 };
  return f;
}

export function paging(q, max = 60) {
  const limit = Math.min(Math.max(parseInt(q.limit) || 12, 1), max);
  const page = Math.max(parseInt(q.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
}

r.get("/categories", async (_req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find({ active: true }).sort({ sort: 1, name: 1 }).lean(),
    Product.aggregate([{ $match: { active: true } }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json({ items: cats.map((c) => ({ ...c, count: map.get(String(c._id)) || 0 })) });
});

r.get("/categories/:slug", async (req, res) => {
  const cat = await Category.findOne({ slug: req.params.slug, active: true });
  if (!cat) throw notFound("Category");
  res.json({ item: cat });
});

r.get("/products", async (req, res) => {
  const filter = await buildProductFilter(req.query);
  const { limit, page, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[req.query.sort] || SORTS.new).skip(skip).limit(limit).populate("category", "name slug kind"),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

r.get("/products/:slug", async (req, res) => {
  const item = await Product.findOne({ slug: req.params.slug, active: true }).populate("category", "name slug kind");
  if (!item) throw notFound("Product");
  const related = await Product.find({ category: item.category._id, _id: { $ne: item._id }, active: true })
    .limit(4).populate("category", "name slug kind");
  res.json({ item, related });
});

r.get("/products/:id/reviews", async (req, res) => {
  const items = await Review.find({ product: req.params.id, approved: true }).sort({ createdAt: -1 }).limit(50);
  res.json({ items });
});

r.post("/products/:id/reviews", protect, validate(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })), async (req, res) => {
  if (!(await Product.exists({ _id: req.params.id }))) throw notFound("Product");
  const item = await Review.findOneAndUpdate(
    { product: req.params.id, user: req.user._id },
    { ...req.body, name: req.user.name },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
  await Review.syncProduct(req.params.id);
  res.status(201).json({ item });
});

export default r;
