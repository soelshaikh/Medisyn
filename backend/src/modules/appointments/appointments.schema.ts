import mongoose, { type Document, Schema, type Types } from "mongoose";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export interface IStatusEntry {
  status:        string;
  changedAt:     Date;
  changedBy:     Types.ObjectId | null;
  changedByName: string;
  note:          string;
}

export interface IAppointmentBooking extends Document {
  slotId:             Types.ObjectId;
  patientId:          Types.ObjectId;
  vaccineServiceId:   Types.ObjectId;
  status:             AppointmentStatus;
  statusHistory:      IStatusEntry[];
  patientNotes:       string;
  adminNotes:         string;
  adminReply:         string;
  cancelledAt:        Date | null;
  cancelledBy:        "patient" | "admin" | null;
  cancellationReason: string;
  createdAt:          Date;
  updatedAt:          Date;
}

const StatusEntrySchema = new Schema<IStatusEntry>(
  {
    status:        { type: String, required: true },
    changedAt:     { type: Date, default: () => new Date() },
    changedBy:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedByName: { type: String, default: "" },
    note:          { type: String, default: "" },
  },
  { _id: false },
);

const AppointmentBookingSchema = new Schema<IAppointmentBooking>(
  {
    slotId:             { type: Schema.Types.ObjectId, ref: "AppointmentSlot", required: true },
    patientId:          { type: Schema.Types.ObjectId, ref: "User",            required: true },
    vaccineServiceId:   { type: Schema.Types.ObjectId, ref: "VaccineService",  required: true },
    status:             { type: String, enum: ["pending","confirmed","cancelled","completed","no_show"], default: "pending" },
    statusHistory:      [StatusEntrySchema],
    patientNotes:       { type: String, default: "" },
    adminNotes:         { type: String, default: "", select: false },
    adminReply:         { type: String, default: "" },
    cancelledAt:        { type: Date,   default: null },
    cancelledBy:        { type: String, enum: ["patient","admin",null], default: null },
    cancellationReason: { type: String, default: "" },
  },
  { timestamps: true },
);

AppointmentBookingSchema.index({ patientId:  1, createdAt: -1 });
AppointmentBookingSchema.index({ slotId:     1, status:    1 });
AppointmentBookingSchema.index({ status:     1, createdAt: -1 });

export const AppointmentBookingModel = mongoose.model<IAppointmentBooking>("AppointmentBooking", AppointmentBookingSchema);
