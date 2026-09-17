import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface ICategory extends Document {
  name:        string;
  slug:        string;
  description: string;
  parentId:    Types.ObjectId | null;
  image:       string | null;
  sortOrder:   number;
  isActive:    boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "" },
    parentId:    { type: Schema.Types.ObjectId, ref: "Category", default: null },
    image:       { type: String, default: null },
    sortOrder:   { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentId: 1, sortOrder: 1 });

export const CategoryModel = mongoose.model<ICategory>("Category", CategorySchema);
