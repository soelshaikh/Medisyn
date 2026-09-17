import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IPartnerProfile extends Document {
  userId:          Types.ObjectId;
  companyName:     string;
  contactName:     string;
  phone:           string;
  address:         string;
  licenseNumber:   string;
  website:         string;
  notes:           string;
  adminNotes:      string;
  createdAt:       Date;
  updatedAt:       Date;
}

const PartnerProfileSchema = new Schema<IPartnerProfile>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    companyName:   { type: String, required: true, trim: true },
    contactName:   { type: String, required: true, trim: true },
    phone:         { type: String, required: true },
    address:       { type: String, required: true },
    licenseNumber: { type: String, default: "" },
    website:       { type: String, default: "" },
    notes:         { type: String, default: "" },
    adminNotes:    { type: String, default: "", select: false },
  },
  { timestamps: true }
);

PartnerProfileSchema.index({ userId: 1 });

export const PartnerProfileModel = mongoose.model<IPartnerProfile>("PartnerProfile", PartnerProfileSchema);
