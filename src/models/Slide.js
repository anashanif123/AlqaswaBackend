import mongoose from "mongoose";

// Home page hero carousel slides, managed from the admin panel.
export default mongoose.model(
  "Slide",
  new mongoose.Schema(
    {
      image: String, // desktop photo (wide); without it the slide shows gold line-art on `tone`
      mobileImage: String, // optional portrait photo for phones
      kicker: String,
      title: { type: String, required: true },
      subtitle: String,
      ctaLabel: String,
      ctaLink: String,
      kind: { type: String, enum: ["ring", "necklace", "earring", "bangle", "pendant"], default: "necklace" },
      tone: { type: String, enum: ["emerald", "rose", "sand"], default: "sand" },
      sort: { type: Number, default: 0 },
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);
