import mongoose, { Schema, Document, Types } from "mongoose";

export type PaymentMethod            = "cash" | "card" | "e_transfer" | "cheque";
export type PaymentTransactionType   = "payment" | "refund";

/* payment: pending→completed|failed|refunded(all allocations reversed)
   refund:  pending→completed|failed|cancelled                          */
export type PaymentTransactionStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";

export interface IStatusHistoryEntry {
  status:    PaymentTransactionStatus;
  changedBy: { id: Types.ObjectId; name: string; email: string } | null; /* null = system */
  changedAt: Date;
  note?:     string;
}

export interface IPaymentTransaction extends Document {
  type:     PaymentTransactionType;
  amount:   number;   /* cents — always positive */
  currency: string;   /* "CAD" */
  method:   PaymentMethod;
  reference?: string; /* external ref: terminal txn ID, cheque number, etc. */
  status:   PaymentTransactionStatus;

  /* Who paid / who was refunded */
  payerId?:    Types.ObjectId;
  payerName?:  string;
  payerEmail?: string;

  /* Running allocation totals — meaningful for type="payment" only */
  amountAllocated:   number; /* cents allocated to invoices so far */
  amountUnallocated: number; /* cents = amount - amountAllocated */

  /* Who recorded this transaction (for payments: who entered it; for refunds: who initiated) */
  recordedBy: { id: Types.ObjectId; name: string; email: string };

  /* ── Refund-specific fields ── */
  refundOf?:     Types.ObjectId; /* ref → PaymentTransaction (original payment) */
  refundReason?: string;         /* required when type="refund" */

  /* Who physically processed the refund (may differ from initiator) */
  processedBy?: { id: Types.ObjectId; name: string; email: string };
  processedAt?: Date;

  /* If status="failed" */
  failureReason?: string;

  /* If cancellation auto-refund: financial changes already applied by reverseAllocations */
  financiallySettled: boolean;

  /* Full status transition history */
  statusHistory: IStatusHistoryEntry[];

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

/* ─── Sub-schemas ──────────────────────────────────────────────────────────── */

const StatusHistorySchema = new Schema<IStatusHistoryEntry>({
  status:    { type: String, enum: ["pending", "completed", "failed", "refunded", "cancelled"], required: true },
  changedBy: {
    type: new Schema({
      id:    { type: Schema.Types.ObjectId, required: true },
      name:  { type: String, required: true },
      email: { type: String, required: true },
    }, { _id: false }),
    default: null,
  },
  changedAt: { type: Date, default: Date.now },
  note:      { type: String },
}, { _id: false });

const ActorSchema = new Schema({
  id:    { type: Schema.Types.ObjectId, required: true },
  name:  { type: String, required: true },
  email: { type: String, required: true },
}, { _id: false });

/* ─── Main schema ──────────────────────────────────────────────────────────── */

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    type:      { type: String, enum: ["payment", "refund"], required: true, default: "payment" },
    amount:    { type: Number, required: true, min: 1 },
    currency:  { type: String, default: "CAD" },
    method:    { type: String, enum: ["cash", "card", "e_transfer", "cheque"], required: true },
    reference: { type: String },
    status:    {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "cancelled"],
      default: "completed",
    },

    payerId:    { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    payerName:  { type: String },
    payerEmail: { type: String },

    amountAllocated:   { type: Number, default: 0, min: 0 },
    amountUnallocated: { type: Number, required: true, min: 0 },

    recordedBy: { type: ActorSchema, required: true },

    /* Refund-specific */
    refundOf:      { type: Schema.Types.ObjectId, ref: "PaymentTransaction", sparse: true },
    refundReason:  { type: String },
    processedBy:   { type: ActorSchema },
    processedAt:   { type: Date },
    failureReason: { type: String },

    /* true for auto-refunds created during invoice cancellation — financial changes already applied */
    financiallySettled: { type: Boolean, default: false },

    statusHistory: { type: [StatusHistorySchema], default: [] },

    notes: { type: String },
  },
  { timestamps: true },
);

/* ─── Indexes ──────────────────────────────────────────────────────────────── */

PaymentTransactionSchema.index({ type: 1, status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ payerId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ refundOf: 1 }, { sparse: true });
/* Fast lookup of all pending refunds for the dashboard */
PaymentTransactionSchema.index({ type: 1, status: 1 });

export const PaymentTransactionModel = mongoose.model<IPaymentTransaction>(
  "PaymentTransaction",
  PaymentTransactionSchema,
);
