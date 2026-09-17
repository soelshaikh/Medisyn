import mongoose, { type Document, Schema, type Types } from "mongoose";

export type AilmentRequestStatus = "submitted" | "reviewing" | "responded" | "closed";

export interface IStatusEntry {
  status:        string;
  changedAt:     Date;
  changedBy:     Types.ObjectId | null;
  changedByName: string;
  note:          string;
}

export interface IAilmentRequest extends Document {
  patientId:    Types.ObjectId;
  ailmentId:    Types.ObjectId;
  ailmentName:  string;
  formData:     Record<string, unknown>;
  notes:        string;
  status:       AilmentRequestStatus;
  responseText: string;
  respondedAt:  Date | null;
  respondedBy:  Types.ObjectId | null;
  statusHistory: IStatusEntry[];
  adminNotes:   string;
  createdAt:    Date;
  updatedAt:    Date;
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

const AilmentRequestSchema = new Schema<IAilmentRequest>(
  {
    patientId:     { type: Schema.Types.ObjectId, ref: "User",          required: true },
    ailmentId:     { type: Schema.Types.ObjectId, ref: "AilmentCatalog", required: true },
    ailmentName:   { type: String, required: true },
    formData:      { type: Schema.Types.Mixed, default: {} },
    notes:         { type: String, default: "" },
    status:        { type: String, enum: ["submitted","reviewing","responded","closed"], default: "submitted" },
    responseText:  { type: String, default: "" },
    respondedAt:   { type: Date,   default: null },
    respondedBy:   { type: Schema.Types.ObjectId, ref: "User", default: null },
    statusHistory: [StatusEntrySchema],
    adminNotes:    { type: String, default: "", select: false },
  },
  { timestamps: true }
);

AilmentRequestSchema.index({ patientId: 1, createdAt: -1 });
AilmentRequestSchema.index({ status: 1,   createdAt: -1 });

export const AilmentRequestModel = mongoose.model<IAilmentRequest>("AilmentRequest", AilmentRequestSchema);
