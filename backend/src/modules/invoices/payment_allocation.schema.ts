import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPaymentAllocation extends Document {
  transactionId: Types.ObjectId; /* ref → PaymentTransaction */
  invoiceId:     Types.ObjectId; /* ref → Invoice */
  amount:        number;         /* cents applied to this invoice from this transaction */
  allocatedBy:   { id: Types.ObjectId; name: string; email: string };
  notes?:        string;
  createdAt:     Date;
  updatedAt:     Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    transactionId: { type: Schema.Types.ObjectId, ref: "PaymentTransaction", required: true, index: true },
    invoiceId:     { type: Schema.Types.ObjectId, ref: "Invoice",            required: true, index: true },
    amount:        { type: Number, required: true, min: 1 },
    allocatedBy: {
      id:    { type: Schema.Types.ObjectId, required: true },
      name:  { type: String, required: true },
      email: { type: String, required: true },
    },
    notes: { type: String },
  },
  { timestamps: true },
);

/* Composite index — fast lookup of all allocations for a given invoice or transaction */
PaymentAllocationSchema.index({ invoiceId: 1, createdAt: -1 });
PaymentAllocationSchema.index({ transactionId: 1, invoiceId: 1 });

export const PaymentAllocationModel = mongoose.model<IPaymentAllocation>(
  "PaymentAllocation",
  PaymentAllocationSchema,
);
