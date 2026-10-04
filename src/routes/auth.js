import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { protect, signToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../utils/AppError.js";

const r = Router();

const address = z.object({
  label: z.string().max(40).optional(), name: z.string().min(2), phone: z.string().min(7),
  line1: z.string().min(3), line2: z.string().optional(), city: z.string().min(2),
  province: z.string().optional(), postalCode: z.string().optional(),
});

r.post(
  "/register",
  validate(z.object({ name: z.string().min(2).max(80), email: z.email(), phone: z.string().optional(), password: z.string().min(6).max(100) })),
  async (req, res) => {
    const user = await User.create({ ...req.body, role: "customer" });
    res.status(201).json({ token: signToken(user), user });
  }
);

r.post("/login", validate(z.object({ email: z.email(), password: z.string().min(1) })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+password");
  if (!user || !(await user.checkPassword(req.body.password))) throw new AppError("Email or password is incorrect", 401);
  if (user.blocked) throw new AppError("This account has been suspended", 403);
  res.json({ token: signToken(user), user });
});

r.get("/me", protect, (req, res) => res.json({ user: req.user }));

r.patch("/me", protect, validate(z.object({ name: z.string().min(2).max(80).optional(), phone: z.string().optional() })), async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ user: req.user });
});

r.patch("/me/password", protect, validate(z.object({ current: z.string(), password: z.string().min(6).max(100) })), async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.checkPassword(req.body.current))) throw new AppError("Current password is incorrect", 401);
  user.password = req.body.password;
  await user.save();
  res.json({ message: "Password updated" });
});

r.post("/me/addresses", protect, validate(address), async (req, res) => {
  req.user.addresses.push(req.body);
  await req.user.save();
  res.status(201).json({ addresses: req.user.addresses });
});

r.delete("/me/addresses/:id", protect, async (req, res) => {
  req.user.addresses.pull(req.params.id);
  await req.user.save();
  res.json({ addresses: req.user.addresses });
});

r.get("/me/wishlist", protect, async (req, res) => {
  const items = await Product.find({ _id: { $in: req.user.wishlist }, active: true }).populate("category", "name slug kind");
  res.json({ items });
});

/** Toggles a product in the wishlist. */
r.post("/me/wishlist/:productId", protect, async (req, res) => {
  const id = req.params.productId;
  if (!(await Product.exists({ _id: id }))) throw new AppError("Product not found", 404);
  const has = req.user.wishlist.some((w) => String(w) === id);
  has ? req.user.wishlist.pull(id) : req.user.wishlist.push(id);
  await req.user.save();
  res.json({ wishlist: req.user.wishlist, saved: !has });
});

export default r;
