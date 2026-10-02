import mongoose, { type Document, Schema, type Types } from "mongoose";

export type PrescriptionStatus =
  | "submitted"
  | "received"
  | "verified"
  | "dispensed"
  | "cancelled";

export interface IStatusEntry {
  status:        string;
  changedAt:     Date;
  changedBy:     Types.ObjectId | null;
  changedByName: string;
  note:          string;
}

export interface IPrescription extends Document {
  patientId:             Types.ObjectId;
  requestType:           "standard" | "new_delivery" | "refill" | "transfer";
  prescriptionNumber:    string;
  prescriberName:        string;
  prescriberLicense:     string;
  prescriberPhone:       string;
  medicationName:        string;
  dosage:                string;
  refillsRemaining:      number;
  expiresAt:             Date | null;
  notes:                 string;
  /* Request-type-specific fields */
  deliveryAddress:       string;
  dateOfBirth:           string;
  previousPharmacyName:  string;
  previousPharmacyPhone: string;
  transferAll:           boolean;
  rxNumbers:             string[];
  status:                PrescriptionStatus;
  statusHistory:         IStatusEntry[];
  adminNotes:            string;
  createdAt:             Date;
  updatedAt:             Date;
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

const PrescriptionSchema = new Schema<IPrescription>(
  {
    patientId:             { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestType:           { type: String, enum: ["standard","new_delivery","refill","transfer"], default: "standard" },
    prescriptionNumber:    { type: String, default: "", trim: true },
    prescriberName:        { type: String, default: "" },
    prescriberLicense:     { type: String, default: "" },
    prescriberPhone:       { type: String, default: "" },
    medicationName:        { type: String, default: "" },
    dosage:                { type: String, default: "" },
    refillsRemaining:      { type: Number, default: 0 },
    expiresAt:             { type: Date,   default: null },
    notes:                 { type: String, default: "" },
    /* Request-type-specific */
    deliveryAddress:       { type: String, default: "" },
    dateOfBirth:           { type: String, default: "" },
    previousPharmacyName:  { type: String, default: "" },
    previousPharmacyPhone: { type: String, default: "" },
    transferAll:           { type: Boolean, default: false },
    rxNumbers:             [{ type: String }],
    status: {
      type:    String,
      enum:    ["submitted","received","verified","dispensed","cancelled"],
      default: "submitted",
    },
    statusHistory:         [StatusEntrySchema],
    adminNotes:            { type: String, default: "", select: false },
  },
  { timestamps: true }
);

PrescriptionSchema.index({ patientId: 1, createdAt: -1 });
PrescriptionSchema.index({ status:    1, createdAt: -1 });
PrescriptionSchema.index({ expiresAt: 1 });

export const PrescriptionModel = mongoose.model<IPrescription>("Prescription", PrescriptionSchema);
