import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IClinicProfile extends Document {
  userId:         Types.ObjectId;
  clinicName:     string;
  contactName:    string;
  clinicPhone:    string;
  clinicAddress:  string;
  licenseNumber:  string;
  website:        string;
  notes:          string;
  adminNotes:     string;
  createdAt:      Date;
  updatedAt:      Date;
}

const ClinicProfileSchema = new Schema<IClinicProfile>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    clinicName:    { type: String, required: true, trim: true },
    contactName:   { type: String, required: true, trim: true },
    clinicPhone:   { type: String, required: true },
    clinicAddress: { type: String, required: true },
    licenseNumber: { type: String, default: "" },
    website:       { type: String, default: "" },
    notes:         { type: String, default: "" },
    adminNotes:    { type: String, default: "", select: false },
  },
  { timestamps: true }
);

ClinicProfileSchema.index({ userId: 1 });

export const ClinicProfileModel = mongoose.model<IClinicProfile>("ClinicProfile", ClinicProfileSchema);
