import mongoose, { type Document, Schema, type Types } from "mongoose";

export type TriggerModule =
  | "orders"
  | "prescriptions"
  | "compounding"
  | "appointments"
  | "ask-pharmacist";

export type RecipientType = "customer" | "assigned_staff" | "admin_team";

export interface IEmailTriggerConfig extends Document {
  module:         TriggerModule;
  fromStatus:     string | null; // null = any/initial state
  toStatus:       string;
  enabled:        boolean;
  templateKey:    string;
  recipientTypes: RecipientType[];
  description:    string;
  updatedAt:      Date;
  updatedBy:      Types.ObjectId | null;
}

const EmailTriggerConfigSchema = new Schema<IEmailTriggerConfig>(
  {
    module:         { type: String, required: true, enum: ["orders","prescriptions","compounding","appointments","ask-pharmacist"] },
    fromStatus:     { type: String, default: null },
    toStatus:       { type: String, required: true },
    enabled:        { type: Boolean, default: true },
    templateKey:    { type: String, required: true },
    recipientTypes: [{ type: String, enum: ["customer","assigned_staff","admin_team"] }],
    description:    { type: String, default: "" },
    updatedBy:      { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

EmailTriggerConfigSchema.index({ module: 1, fromStatus: 1, toStatus: 1 }, { unique: true });

export const EmailTriggerConfigModel = mongoose.model<IEmailTriggerConfig>(
  "EmailTriggerConfig",
  EmailTriggerConfigSchema,
);
