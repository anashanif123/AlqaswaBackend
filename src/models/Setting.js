import mongoose from "mongoose";

// Single document holding store-wide settings.
const settingSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "Al Qaswa" },
    announcement: { type: String, default: "" }, // empty hides the top bar
    shippingFee: { type: Number, default: 300 },
    freeShippingOver: { type: Number, default: 0 }, // 0 = no free delivery
    whatsapp: { type: String, default: "923120253799" },
    phone: { type: String, default: "+92 312 0253799" },
    email: { type: String, default: "hello@alqaswa.pk" },
    address: { type: String, default: "Studio, Gulberg III, Lahore" },
    bankDetails: { type: String, default: "" },
    codEnabled: { type: Boolean, default: true },
    bankEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingSchema.statics.get = async function () {
  return (await this.findOne()) || this.create({});
};

export default mongoose.model("Setting", settingSchema);
