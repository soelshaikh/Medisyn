import mongoose, { type Document, Schema, type Types } from "mongoose";

export type CapacityType = "strict" | "open";
export type SlotStatus   = "active" | "cancelled";

export interface IAppointmentSlot extends Document {
  vaccineServiceId: Types.ObjectId;
  date:             Date;
  startTime:        string;
  endTime:          string;
  capacity:         number;
  bookedCount:      number;
  capacityType:     CapacityType;
  adminNotes:       string;
  status:           SlotStatus;
  createdAt:        Date;
  updatedAt:        Date;
}

const AppointmentSlotSchema = new Schema<IAppointmentSlot>(
  {
    vaccineServiceId: { type: Schema.Types.ObjectId, ref: "VaccineService", required: true },
    date:             { type: Date, required: true },
    startTime:        { type: String, required: true },
    endTime:          { type: String, required: true },
    capacity:         { type: Number, required: true, min: 1 },
    bookedCount:      { type: Number, default: 0, min: 0 },
    capacityType:     { type: String, enum: ["strict", "open"], default: "strict" },
    adminNotes:       { type: String, default: "", select: false },
    status:           { type: String, enum: ["active", "cancelled"], default: "active" },
  },
  { timestamps: true },
);

AppointmentSlotSchema.index({ date: 1, status: 1 });
AppointmentSlotSchema.index({ vaccineServiceId: 1, date: 1 });

export const AppointmentSlotModel = mongoose.model<IAppointmentSlot>("AppointmentSlot", AppointmentSlotSchema);
