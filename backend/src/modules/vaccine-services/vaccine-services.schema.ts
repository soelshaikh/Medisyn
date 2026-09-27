import mongoose, { type Document, Schema } from "mongoose";

export interface IVaccineService extends Document {
  name:             string;
  slug:             string;
  description:      string;
  eligibilityNotes: string;
  durationMinutes:  number;
  status:           "active" | "inactive";
  sortOrder:        number;
  createdAt:        Date;
  updatedAt:        Date;
}

const VaccineServiceSchema = new Schema<IVaccineService>(
  {
    name:             { type: String, required: true, trim: true },
    slug:             { type: String, required: true, unique: true, trim: true },
    description:      { type: String, default: "" },
    eligibilityNotes: { type: String, default: "" },
    durationMinutes:  { type: Number, required: true, min: 1, default: 15 },
    status:           { type: String, enum: ["active", "inactive"], default: "active" },
    sortOrder:        { type: Number, default: 0 },
  },
  { timestamps: true },
);

VaccineServiceSchema.index({ status: 1, sortOrder: 1 });
VaccineServiceSchema.index({ slug: 1 }, { unique: true });

export const VaccineServiceModel = mongoose.model<IVaccineService>("VaccineService", VaccineServiceSchema);
