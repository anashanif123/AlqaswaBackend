// Fills the database with the starter catalogue and an admin account.
// Usage: npm run seed            (keeps existing data, only adds what is missing)
//        npm run seed -- --fresh (wipes catalogue first)
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import Category from "./models/Category.js";
import Product from "./models/Product.js";
import Coupon from "./models/Coupon.js";
import User from "./models/User.js";
import Setting from "./models/Setting.js";
import { slugify } from "./utils/slugify.js";

const categories = [
  { name: "Rings", kind: "ring", sort: 1, description: "Solitaires, bands and everyday stacking rings in hallmarked gold." },
  { name: "Necklaces", kind: "necklace", sort: 2, description: "Layered chains, chokers and statement pieces." },
  { name: "Earrings", kind: "earring", sort: 3, description: "Studs, drops and jhumkas for every day and every occasion." },
  { name: "Bangles", kind: "bangle", sort: 4, description: "Karas and bangles in 22k gold." },
  { name: "Pendants", kind: "pendant", sort: 5, description: "Crescents, stones and keepsakes on fine chains." },
];

const products = [
  ["Noor solitaire ring", "ring", "18k gold, lab diamond", 84500, 92000, "New", "emerald", ["5", "6", "7", "8"]],
  ["Zainab layered necklace", "necklace", "22k gold", 212000, null, "", "rose"],
  ["Hira drop earrings", "earring", "Gold vermeil, pearl", 18900, null, "Bestseller", "night"],
  ["Mehr kara bangle", "bangle", "22k gold", 156000, null, "", "emerald", ["2.4", "2.6", "2.8"]],
  ["Qamar crescent pendant", "pendant", "18k gold", 42000, null, "", "rose"],
  ["Ayla twist band", "ring", "18k rose gold", 36500, null, "", "night", ["5", "6", "7", "8"]],
  ["Saba emerald studs", "earring", "18k gold, emerald", 58000, null, "New", "emerald"],
  ["Rania pearl choker", "necklace", "Silver, freshwater pearl", 27500, 32000, "", "rose"],
  ["Sitara halo ring", "ring", "18k white gold, lab diamond", 118000, null, "", "night", ["5", "6", "7"]],
  ["Laila jhumka earrings", "earring", "22k gold", 64000, null, "Bestseller", "rose"],
  ["Hayat chain bracelet bangle", "bangle", "18k gold", 48000, null, "", "night", ["2.4", "2.6"]],
  ["Amal initial pendant", "pendant", "18k gold", 26500, null, "New", "emerald"],
];

const fresh = process.argv.includes("--fresh");
await connectDB();

if (fresh) await Promise.all([Category.deleteMany({}), Product.deleteMany({}), Coupon.deleteMany({})]);

const catByKind = {};
for (const c of categories) {
  catByKind[c.kind] = await Category.findOneAndUpdate({ slug: slugify(c.name) }, { $setOnInsert: { ...c, slug: slugify(c.name) } }, { upsert: true, returnDocument: "after" });
}

for (const [name, kind, metal, price, compareAtPrice, tag, tone, sizes = []] of products) {
  await Product.updateOne(
    { slug: slugify(name) },
    {
      $setOnInsert: {
        name, slug: slugify(name), category: catByKind[kind]._id, metal, price, compareAtPrice: compareAtPrice ?? undefined,
        tag: tag || undefined, tone, sizes, stock: 10, featured: true, sku: `AQ-${kind.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`,
        description: `${name} in ${metal.toLowerCase()}. Designed and finished by hand in our Lahore studio, hallmarked and delivered with a certificate of authenticity.`,
      },
    },
    { upsert: true }
  );
}

await Coupon.updateOne(
  { code: "WELCOME10" },
  { $setOnInsert: { code: "WELCOME10", description: "10% off your first order", type: "percent", value: 10, maxDiscount: 15000, perUserLimit: 1 } },
  { upsert: true }
);
await Setting.get();

const email = (process.env.ADMIN_EMAIL || "admin@alqaswa.pk").toLowerCase();
if (!(await User.exists({ email }))) {
  await User.create({ name: "Store admin", email, password: process.env.ADMIN_PASSWORD || "Admin@12345", role: "admin" });
  console.log(`Admin created: ${email}`);
}

console.log("Seed complete");
await mongoose.disconnect();
