import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IProductImage {
  url:       string;
  alt:       string;
  isPrimary: boolean;
}

export interface IProduct extends Document {
  name:                string;
  slug:                string;
  sku:                 string;
  description:         string;
  shortDescription:    string;
  categoryId:          Types.ObjectId;
  images:              IProductImage[];
  price:               number; // cents
  compareAtPrice:      number | null; // cents
  requiresPrescription: boolean;
  ageRestriction:      number | null;
  status:              "draft" | "active" | "archived";
  tags:                string[];
  weight:              number | null; // grams
  metaTitle:           string;
  metaDescription:     string;
  createdAt:           Date;
  updatedAt:           Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name:             { type: String, required: true, trim: true },
    slug:             { type: String, required: true, unique: true, lowercase: true, trim: true },
    sku:              { type: String, required: true, unique: true, uppercase: true, trim: true },
    description:      { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    categoryId:       { type: Schema.Types.ObjectId, ref: "Category", required: true },
    images: [{
      url:       { type: String, required: true },
      alt:       { type: String, default: "" },
      isPrimary: { type: Boolean, default: false },
    }],
    price:               { type: Number, required: true, min: 0 },
    compareAtPrice:      { type: Number, default: null },
    requiresPrescription:{ type: Boolean, default: false },
    ageRestriction:      { type: Number, default: null },
    status:              { type: String, enum: ["draft", "active", "archived"], default: "draft" },
    tags:                [{ type: String }],
    weight:              { type: Number, default: null },
    metaTitle:           { type: String, default: "" },
    metaDescription:     { type: String, default: "" },
  },
  { timestamps: true }
);

ProductSchema.index({ slug: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ status: 1, categoryId: 1 });
ProductSchema.index({ name: "text", description: "text", tags: "text" });

export const ProductModel = mongoose.model<IProduct>("Product", ProductSchema);
