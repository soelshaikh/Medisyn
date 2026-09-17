import mongoose, { type Document, Schema } from "mongoose";
import slugify from "slugify";

export interface IIntakeField {
  label:       string;
  type:        "text" | "textarea" | "select" | "radio" | "checkbox";
  options:     string[];
  placeholder: string;
  required:    boolean;
  sortOrder:   number;
}

export interface IAilmentCatalog extends Document {
  name:             string;
  slug:             string;
  description:      string;
  intakeFormFields: IIntakeField[];
  isActive:         boolean;
  sortOrder:        number;
  createdAt:        Date;
  updatedAt:        Date;
}

const IntakeFieldSchema = new Schema<IIntakeField>(
  {
    label:       { type: String, required: true },
    type:        { type: String, enum: ["text", "textarea", "select", "radio", "checkbox"], required: true },
    options:     [{ type: String }],
    placeholder: { type: String, default: "" },
    required:    { type: Boolean, default: false },
    sortOrder:   { type: Number, default: 0 },
  },
  { _id: false }
);

const AilmentCatalogSchema = new Schema<IAilmentCatalog>(
  {
    name:             { type: String, required: true, trim: true },
    slug:             { type: String, unique: true },
    description:      { type: String, default: "" },
    intakeFormFields: [IntakeFieldSchema],
    isActive:         { type: Boolean, default: true },
    sortOrder:        { type: Number, default: 0 },
  },
  { timestamps: true }
);

AilmentCatalogSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

AilmentCatalogSchema.index({ isActive: 1, sortOrder: 1 });

export const AilmentCatalogModel = mongoose.model<IAilmentCatalog>("AilmentCatalog", AilmentCatalogSchema);
