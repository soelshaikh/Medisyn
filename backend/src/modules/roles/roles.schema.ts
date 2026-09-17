import mongoose, { type Document, type Model } from "mongoose";

export interface IRole extends Document {
  name: string;
  slug: string;
  description: string;
  permissions: string[];   // permission keys e.g. ["users.read", "orders.read"]
  isSystem: boolean;       // system roles (ADMIN) cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IRole>(
  {
    name:        { type: String, required: true },
    slug:        { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    isSystem:    { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const RoleModel: Model<IRole> =
  mongoose.models.Role ?? mongoose.model<IRole>("Role", schema);
