import mongoose, { type Document, Schema, type Types } from "mongoose";

export type CompoundingStatus =
  | "submitted" | "reviewing" | "quote_sent"
  | "approved"  | "in_production" | "ready"
  | "delivered" | "cancelled";

export interface IStatusEntry {
  status:        string;
  changedAt:     Date;
  changedBy:     Types.ObjectId | null;
  changedByName: string;
  note:          string;
}

export interface ICompoundingRequest extends Document {
  patientId:         Types.ObjectId;
  medicationName:    string;
  strength:          string;
  form:              "capsule" | "cream" | "liquid" | "suppository" | "other";
  quantity:          string;
  prescriberName:    string;
  prescriberLicense: string;
  notes:             string;
  fileUrl:           string;
  status:            CompoundingStatus;
  quoteAmount:       number | null;
  quoteNote:         string;
  statusHistory:     IStatusEntry[];
  adminNotes:        string;
  createdAt:         Date;
  updatedAt:         Date;
}

const StatusEntrySchema = new Schema<IStatusEntry>(
  {
    status:        { type: String, required: true },
    changedAt:     { type: Date,   default: () => new Date() },
    changedBy:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedByName: { type: String, default: "" },
    note:          { type: String, default: "" },
  },
  { _id: false }
);

const CompoundingSchema = new Schema<ICompoundingRequest>(
  {
    patientId:         { type: Schema.Types.ObjectId, ref: "User", required: true },
    medicationName:    { type: String, required: true, trim: true },
    strength:          { type: String, default: "" },
    form:              { type: String, enum: ["capsule","cream","liquid","suppository","other"], required: true },
    quantity:          { type: String, required: true },
    prescriberName:    { type: String, required: true },
    prescriberLicense: { type: String, required: true },
    notes:             { type: String, default: "" },
    fileUrl:           { type: String, default: "" },
    status:            {
      type: String,
      enum: ["submitted","reviewing","quote_sent","approved","in_production","ready","delivered","cancelled"],
      default: "submitted",
    },
    quoteAmount: { type: Number, default: null },
    quoteNote:   { type: String, default: "" },
    statusHistory: [StatusEntrySchema],
    adminNotes:    { type: String, default: "", select: false },
  },
  { timestamps: true }
);

CompoundingSchema.index({ patientId: 1, createdAt: -1 });
CompoundingSchema.index({ status:    1, createdAt: -1 });

export const CompoundingModel = mongoose.model<ICompoundingRequest>("CompoundingRequest", CompoundingSchema);
