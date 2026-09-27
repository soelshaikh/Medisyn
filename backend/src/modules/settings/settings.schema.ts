import mongoose, { type Document, Schema } from "mongoose";

export interface IWorkingHours {
  day: number; // 0=Sun, 1=Mon, ..., 6=Sat
  isOpen: boolean;
  openTime: string;  // "09:00"
  closeTime: string; // "18:00"
}

export interface IHoliday {
  _id: mongoose.Types.ObjectId;
  date: string; // "YYYY-MM-DD"
  name: string;
  isClosed: boolean;
}

export interface IPharmacySettings extends Document {
  workingHours: IWorkingHours[];
  holidays: mongoose.Types.DocumentArray<IHoliday>;
  pharmacyName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  licenseNumber: string;
  updatedAt: Date;
}

const WorkingHoursSchema = new Schema<IWorkingHours>({
  day:       { type: Number, required: true, min: 0, max: 6 },
  isOpen:    { type: Boolean, default: true },
  openTime:  { type: String, default: "09:00" },
  closeTime: { type: String, default: "18:00" },
}, { _id: false });

const HolidaySchema = new Schema<IHoliday>({
  date:     { type: String, required: true },
  name:     { type: String, required: true },
  isClosed: { type: Boolean, default: true },
});

const PharmacySettingsSchema = new Schema<IPharmacySettings>({
  workingHours: { type: [WorkingHoursSchema], default: [] },
  holidays:     { type: [HolidaySchema], default: [] },
  pharmacyName: { type: String, default: "MediSyn Compounding Pharmacy" },
  phone:        { type: String, default: "" },
  email:        { type: String, default: "" },
  address:      { type: String, default: "" },
  city:         { type: String, default: "" },
  province:     { type: String, default: "ON" },
  postalCode:   { type: String, default: "" },
  licenseNumber:{ type: String, default: "" },
}, { timestamps: true });

export const PharmacySettingsModel: mongoose.Model<IPharmacySettings> =
  mongoose.models.PharmacySettings ??
  mongoose.model<IPharmacySettings>("PharmacySettings", PharmacySettingsSchema);
