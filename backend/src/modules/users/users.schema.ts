import mongoose, { type Document, type Model } from "mongoose";

export type UserRole   = "patient" | "clinic" | "pharmacy_partner";
export type UserStatus = "pending_verification" | "active" | "pending_approval" | "approved" | "rejected" | "suspended" | "deactivated";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  roles: mongoose.Types.ObjectId[];
  directPermissions: string[];
  fullName: string;
  phone?: string;
  status: UserStatus;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<IUser>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role:         { type: String, required: true, enum: ["patient", "clinic", "pharmacy_partner"], index: true },
    roles:        { type: [mongoose.Schema.Types.ObjectId], ref: "Role", default: [] },
    directPermissions: { type: [String], default: [] },
    fullName:     { type: String, required: true, trim: true },
    phone:        { type: String },
    status: {
      type: String,
      required: true,
      default: "pending_verification",
      enum: ["pending_verification", "active", "pending_approval", "approved", "rejected", "suspended", "deactivated"],
      index: true,
    },
    emailVerified:            { type: Boolean, default: false },
    verificationToken:        { type: String, select: false },
    verificationTokenExpires: { type: Date,   select: false },
    resetToken:               { type: String, select: false },
    resetTokenExpires:        { type: Date,   select: false },
  },
  { timestamps: true },
);

schema.index({ email: 1 });
schema.index({ role: 1, status: 1 });
schema.index({ createdAt: -1 });

export const UserModel: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", schema);
