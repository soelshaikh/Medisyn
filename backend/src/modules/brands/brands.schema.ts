import mongoose, { type Document, Schema } from "mongoose";

export interface IBrand extends Document {
  name:        string;
  slug:        string;
  description: string;
  logoUrl:     string;
  website:     string;
  isActive:    boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name:        { type: String, required: true, trim: true, unique: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    logoUrl:     { type: String, default: "" },
    website:     { type: String, default: "" },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

BrandSchema.index({ slug: 1 });
BrandSchema.index({ isActive: 1 });

export const BrandModel = mongoose.model<IBrand>("Brand", BrandSchema);
