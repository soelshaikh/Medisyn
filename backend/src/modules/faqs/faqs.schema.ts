import mongoose, { type Document, Schema } from "mongoose";

export interface IFAQ extends Document {
  question:    string;
  answer:      string;
  category:    string;
  sortOrder:   number;
  isPublished: boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const FAQSchema = new Schema<IFAQ>(
  {
    question:    { type: String, required: true, trim: true },
    answer:      { type: String, required: true },
    category:    { type: String, default: "General", trim: true },
    sortOrder:   { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

FAQSchema.index({ category: 1, sortOrder: 1 });
FAQSchema.index({ isPublished: 1 });

export const FAQModel = mongoose.model<IFAQ>("FAQ", FAQSchema);
