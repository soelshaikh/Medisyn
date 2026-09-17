import mongoose, { type Document, type Model } from "mongoose";

export interface IPermission extends Document {
  key: string;       // e.g. "prescriptions.read"
  group: string;     // e.g. "prescriptions"
  description: string;
  createdAt: Date;
}

const schema = new mongoose.Schema<IPermission>(
  {
    key:         { type: String, required: true, unique: true, index: true },
    group:       { type: String, required: true, index: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);

export const PermissionModel: Model<IPermission> =
  mongoose.models.Permission ?? mongoose.model<IPermission>("Permission", schema);
