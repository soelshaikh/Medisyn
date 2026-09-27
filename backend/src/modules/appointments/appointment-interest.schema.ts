import mongoose, { type Document, Schema, type Types } from "mongoose";

export type AppointmentInterestStatus = "new" | "contacted" | "resolved";

export interface IAppointmentInterest extends Document {
  patientId:          Types.ObjectId | null;
  firstName:          string;
  lastName:           string;
  email:              string;
  phone:              string;
  vaccineServiceName: string;
  preferredDate:      string;
  preferredTime:      string;
  notes:              string;
  termsAccepted:      boolean;
  status:             AppointmentInterestStatus;
  adminNote:          string;
  createdAt:          Date;
  updatedAt:          Date;
}

const AppointmentInterestSchema = new Schema<IAppointmentInterest>(
  {
    patientId:          { type: Schema.Types.ObjectId, ref: "User", default: null },
    firstName:          { type: String, required: true, trim: true, maxlength: 100 },
    lastName:           { type: String, default: "",    trim: true, maxlength: 100 },
    email:              { type: String, required: true, trim: true, lowercase: true },
    phone:              { type: String, required: true, trim: true },
    vaccineServiceName: { type: String, default: "",    trim: true },
    preferredDate:      { type: String, default: "" },
    preferredTime:      { type: String, default: "" },
    notes:              { type: String, default: "" },
    termsAccepted:      { type: Boolean, default: false },
    status:             { type: String, enum: ["new","contacted","resolved"], default: "new" },
    adminNote:          { type: String, default: "", select: false },
  },
  { timestamps: true }
);

AppointmentInterestSchema.index({ status: 1, createdAt: -1 });

export const AppointmentInterestModel = mongoose.model<IAppointmentInterest>(
  "AppointmentInterest",
  AppointmentInterestSchema
);
