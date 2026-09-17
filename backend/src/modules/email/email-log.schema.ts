import mongoose, { type Document, Schema } from "mongoose";

export interface IEmailLog extends Document {
  to:        string;
  subject:   string;
  type:      string;
  status:    "sent" | "failed" | "skipped";
  messageId: string;
  error?:    string;
  metadata:  Record<string, unknown>;
  createdAt: Date;
}

const EmailLogSchema = new Schema<IEmailLog>(
  {
    to:        { type: String, required: true, index: true },
    subject:   { type: String, required: true },
    type:      { type: String, required: true, index: true },
    status:    { type: String, enum: ["sent", "failed", "skipped"], required: true },
    messageId: { type: String },
    error:     { type: String },
    metadata:  { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EmailLogModel = mongoose.model<IEmailLog>("EmailLog", EmailLogSchema);
