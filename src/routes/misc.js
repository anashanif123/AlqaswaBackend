import { Router } from "express";
import { z } from "zod";
import Setting from "../models/Setting.js";
import Subscriber from "../models/Subscriber.js";
import Message from "../models/Message.js";
import { validate } from "../middleware/validate.js";

const r = Router();

r.get("/settings", async (_req, res) => {
  const s = await Setting.get();
  const { storeName, announcement, shippingFee, freeShippingOver, whatsapp, phone, email, address, bankDetails, codEnabled, bankEnabled } = s;
  res.json({ storeName, announcement, shippingFee, freeShippingOver, whatsapp, phone, email, address, bankDetails, codEnabled, bankEnabled });
});

r.post("/newsletter", validate(z.object({ email: z.email() })), async (req, res) => {
  await Subscriber.updateOne({ email: req.body.email.toLowerCase() }, {}, { upsert: true });
  res.status(201).json({ message: "Subscribed" });
});

r.post(
  "/contact",
  validate(z.object({
    type: z.enum(["contact", "bridal"]).default("contact"), name: z.string().min(2).max(80),
    email: z.email().optional(), phone: z.string().max(20).optional(), date: z.coerce.date().optional(), message: z.string().max(2000).optional(),
  })),
  async (req, res) => {
    await Message.create(req.body);
    res.status(201).json({ message: "Thanks, we will get back to you soon" });
  }
);

export default r;
