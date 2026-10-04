import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema(
  { label: String, name: String, phone: String, line1: String, line2: String, city: String, province: String, postalCode: String },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    blocked: { type: Boolean, default: false },
    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set("toJSON", { transform: (_d, r) => (delete r.password, delete r.__v, r) });

export default mongoose.model("User", userSchema);
