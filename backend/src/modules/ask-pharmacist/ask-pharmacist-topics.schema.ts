import mongoose, { type Document, Schema } from "mongoose";

export interface IAskPharmacistTopic extends Document {
  name:      string;
  slug:      string;
  isActive:  boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const AskPharmacistTopicSchema = new Schema<IAskPharmacistTopic>(
  {
    name:      { type: String, required: true, trim: true, maxlength: 150 },
    slug:      { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive:  { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

AskPharmacistTopicSchema.index({ isActive: 1, sortOrder: 1 });

export const AskPharmacistTopicModel = mongoose.model<IAskPharmacistTopic>(
  "AskPharmacistTopic",
  AskPharmacistTopicSchema
);
