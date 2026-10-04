import mongoose, { type Document, type Model } from "mongoose";

export type UserRole   = "patient" | "clinic" | "pharmacy_partner";
export type UserStatus = "pending_verification" | "active" | "pending_approval" | "approved" | "rejected" | "suspended" | "deactivated";

export interface ISavedAddress {
  _id:        mongoose.Types.ObjectId;
  label:      string;
  fullName:   string;
  phone:      string;
  address1:   string;
  address2:   string;
  city:       string;
  province:   string;
  postalCode: string;
  country:    string;
  isDefault:  boolean;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  roles: mongoose.Types.ObjectId[];
  directPermissions: string[];
  fullName: string;
  phone?: string;
  uhid?: string;
  status: UserStatus;
  emailVerified: boolean;
  verificationToken?: string;
  verificationTokenExpires?: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
  savedAddresses: mongoose.Types.DocumentArray<ISavedAddress>;
  /* PHIPA / PIPEDA consent */
  termsAcceptedAt?: Date;
  privacyPolicyAcceptedAt?: Date;
  privacyPolicyVersion?: string;
  marketingConsent: boolean;
  marketingConsentAt?: Date;
  /* Account lockout (PIPEDA Safeguards) */
  failedLoginAttempts: number;
  lockedUntil?: Date;
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
    uhid:         { type: String, unique: true, sparse: true },
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
    /* PHIPA / PIPEDA consent fields */
    termsAcceptedAt:          { type: Date },
    privacyPolicyAcceptedAt:  { type: Date },
    privacyPolicyVersion:     { type: String },
    marketingConsent:         { type: Boolean, default: false },
    marketingConsentAt:       { type: Date },
    /* Account lockout */
    failedLoginAttempts:      { type: Number, default: 0 },
    lockedUntil:              { type: Date, select: false },
    savedAddresses: {
      type: [{
        label:      { type: String, default: "Home" },
        fullName:   { type: String, required: true },
        phone:      { type: String, required: true },
        address1:   { type: String, required: true },
        address2:   { type: String, default: "" },
        city:       { type: String, required: true },
        province:   { type: String, required: true },
        postalCode: { type: String, required: true },
        country:    { type: String, default: "CA" },
        isDefault:  { type: Boolean, default: false },
      }],
      default: [],
    },
  },
  { timestamps: true },
);

schema.index({ email: 1 });
schema.index({ role: 1, status: 1 });
schema.index({ createdAt: -1 });

export const UserModel: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", schema);
