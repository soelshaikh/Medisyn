import mongoose, { Schema, type Document } from "mongoose";

export type NotificationType =
  | "order_update"
  | "prescription_update"
  | "compounding_update"
  | "appointment_update"
  | "ask_pharmacist_update"
  | "system";

export interface INotification extends Document {
  userId:    mongoose.Types.ObjectId;
  type:      NotificationType;
  title:     string;
  message:   string;
  read:      boolean;
  readAt?:   Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId:   { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type:     { type: String, required: true },
    title:    { type: String, required: true, maxlength: 200 },
    message:  { type: String, required: true, maxlength: 500 },
    read:     { type: Boolean, default: false },
    readAt:   { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>("Notification", NotificationSchema);
