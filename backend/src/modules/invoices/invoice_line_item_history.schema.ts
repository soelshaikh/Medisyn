import mongoose, { Schema, Document, Types } from "mongoose";

export type LineItemHistoryAction = "created" | "updated" | "deleted";

export interface IInvoiceLineItemHistory extends Document {
  lineItemId: Types.ObjectId;
  invoiceId:  Types.ObjectId; /* denormalized for easy per-invoice queries */
  action:     LineItemHistoryAction;
  before?:    Record<string, unknown>; /* full snapshot before change */
  after?:     Record<string, unknown>; /* full snapshot after change */
  changedBy:  { id: Types.ObjectId; name: string; email: string };
  reason?:    string;
  changedAt:  Date;
}

const LineItemHistorySchema = new Schema<IInvoiceLineItemHistory>(
  {
    lineItemId: { type: Schema.Types.ObjectId, required: true, index: true },
    invoiceId:  { type: Schema.Types.ObjectId, required: true, index: true },
    action:     { type: String, enum: ["created", "updated", "deleted"], required: true },
    before:     { type: Schema.Types.Mixed },
    after:      { type: Schema.Types.Mixed },
    changedBy: {
      id:    { type: Schema.Types.ObjectId, required: true },
      name:  { type: String, required: true },
      email: { type: String, required: true },
    },
    reason:    { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

export const InvoiceLineItemHistoryModel = mongoose.model<IInvoiceLineItemHistory>(
  "InvoiceLineItemHistory",
  LineItemHistorySchema,
);
