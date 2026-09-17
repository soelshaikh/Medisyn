import mongoose, { type Document, Schema, type Types } from "mongoose";

export type AskPharmacistStatus = "open" | "answered" | "closed";

export interface IStatusEntry {
  status:        string;
  changedAt:     Date;
  changedBy:     Types.ObjectId | null;
  changedByName: string;
  note:          string;
}

export interface IAskPharmacist extends Document {
  patientId:     Types.ObjectId;
  subject:       string;
  question:      string;
  fileUrl:       string;
  status:        AskPharmacistStatus;
  responseText:  string;
  respondedAt:   Date | null;
  respondedBy:   Types.ObjectId | null;
  statusHistory: IStatusEntry[];
  adminNotes:    string;
  createdAt:     Date;
  updatedAt:     Date;
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

const AskPharmacistSchema = new Schema<IAskPharmacist>(
  {
    patientId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject:      { type: String, required: true, trim: true, maxlength: 200 },
    question:     { type: String, required: true },
    fileUrl:      { type: String, default: "" },
    status:       { type: String, enum: ["open","answered","closed"], default: "open" },
    responseText: { type: String, default: "" },
    respondedAt:  { type: Date,   default: null },
    respondedBy:  { type: Schema.Types.ObjectId, ref: "User", default: null },
    statusHistory: [StatusEntrySchema],
    adminNotes:    { type: String, default: "", select: false },
  },
  { timestamps: true }
);

AskPharmacistSchema.index({ patientId: 1, createdAt: -1 });
AskPharmacistSchema.index({ status:    1, createdAt: -1 });

export const AskPharmacistModel = mongoose.model<IAskPharmacist>("AskPharmacist", AskPharmacistSchema);
