import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IAuditLog extends Document {
  userId:     Types.ObjectId | null;
  userEmail:  string;
  actorName:  string;
  action:     string;
  resource:   string;
  resourceId: string;
  details:    Record<string, unknown>;
  before:     Record<string, unknown> | null;
  after:      Record<string, unknown> | null;
  ipAddress:  string;
  createdAt:  Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: "User", default: null },
    userEmail:  { type: String, default: "system" },
    actorName:  { type: String, default: "system" },
    action:     { type: String, required: true },
    resource:   { type: String, required: true },
    resourceId: { type: String, default: "" },
    details:    { type: Schema.Types.Mixed, default: {} },
    before:     { type: Schema.Types.Mixed, default: null },
    after:      { type: Schema.Types.Mixed, default: null },
    ipAddress:  { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
