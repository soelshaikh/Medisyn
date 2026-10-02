import mongoose, { Schema, Document, Types } from "mongoose";

/* ─── Embedded snapshot types ──────────────────────────────────────────────── */

export interface IInvoiceAddress {
  fullName:     string;
  phone:        string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  province:     string;
  postalCode:   string;
  country:      string;
}

export interface IInvoiceTaxLine {
  label:  string; /* e.g. "GST (5%)" */
  rate:   number; /* decimal e.g. 0.05 */
  amount: number; /* cents */
}

export interface IAuditStamp {
  id:    Types.ObjectId;
  name:  string;
  email: string;
}

/* ─── Enums ────────────────────────────────────────────────────────────────── */

export type InvoiceType          = "ecommerce" | "adhoc";
export type InvoiceStatus        = "draft" | "finalized" | "cancelled" | "system_cancelled";
export type InvoicePaymentStatus = "unpaid" | "partial_paid" | "paid" | "overpaid" | "cancelled" | "system_cancelled";

/* ─── Main document ────────────────────────────────────────────────────────── */

export interface IInvoice extends Document {
  invoiceNumber:  string;
  type:           InvoiceType;
  status:         InvoiceStatus;
  paymentStatus:  InvoicePaymentStatus;

  /* Ecommerce link */
  orderId?:      Types.ObjectId;
  orderNumber?:  string;

  /* Customer snapshot */
  customerId?:   Types.ObjectId;
  customerName:  string;
  customerEmail: string;

  /* Billing address snapshot */
  billingAddress: IInvoiceAddress;

  /* Totals — derived from line items, stored for performance */
  subtotal:       number; /* cents */
  discountAmount: number; /* cents */
  couponCode?:    string;
  taxLines:       IInvoiceTaxLine[];
  taxTotal:       number; /* cents — sum of taxLines[].amount */
  total:          number; /* cents — subtotal - discountAmount + taxTotal */

  /* Payment tracking — updated after every allocation */
  amountPaid: number; /* cents */
  amountDue:  number; /* cents — total - amountPaid */

  /* Notes */
  notes?:         string; /* visible on PDF */
  internalNotes?: string; /* admin only — never on PDF, never exposed to patient */

  /* Guest download */
  guestToken?:          string;
  guestTokenExpiresAt?: Date;

  /* Set when status → finalized */
  issuedAt?: Date;

  /* Cancellation */
  cancelledAt?:  Date;
  cancelledBy?:  IAuditStamp;
  cancelReason?: string;

  /* Creation */
  createdBy?: IAuditStamp;

  createdAt: Date;
  updatedAt: Date;
}

/* ─── Sub-schemas ──────────────────────────────────────────────────────────── */

const AddressSchema = new Schema<IInvoiceAddress>({
  fullName:     { type: String, required: true },
  phone:        { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city:         { type: String, required: true },
  province:     { type: String, required: true },
  postalCode:   { type: String, required: true },
  country:      { type: String, required: true },
}, { _id: false });

const TaxLineSchema = new Schema<IInvoiceTaxLine>({
  label:  { type: String, required: true },
  rate:   { type: Number, required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const AuditStampSchema = new Schema<IAuditStamp>({
  id:    { type: Schema.Types.ObjectId, required: true },
  name:  { type: String, required: true },
  email: { type: String, required: true },
}, { _id: false });

/* ─── Invoice schema ───────────────────────────────────────────────────────── */

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber:  { type: String, required: true, unique: true },
    type:           { type: String, enum: ["ecommerce", "adhoc"], required: true },
    status:         { type: String, enum: ["draft", "finalized", "cancelled", "system_cancelled"], default: "draft" },
    paymentStatus:  { type: String, enum: ["unpaid", "partial_paid", "paid", "overpaid", "cancelled", "system_cancelled"], default: "unpaid" },

    orderId:        { type: Schema.Types.ObjectId, ref: "Order", sparse: true },
    orderNumber:    { type: String },

    customerId:     { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    customerName:   { type: String, required: true },
    customerEmail:  { type: String, required: true },

    billingAddress: { type: AddressSchema, required: true },

    subtotal:       { type: Number, required: true, default: 0 },
    discountAmount: { type: Number, default: 0 },
    couponCode:     { type: String },
    taxLines:       { type: [TaxLineSchema], default: [] },
    taxTotal:       { type: Number, default: 0 },
    total:          { type: Number, required: true, default: 0 },

    amountPaid: { type: Number, default: 0 },
    amountDue:  { type: Number, default: 0 },

    notes:         { type: String },
    internalNotes: { type: String },

    guestToken:           { type: String, sparse: true },
    guestTokenExpiresAt:  { type: Date },

    issuedAt:      { type: Date },

    cancelledAt:   { type: Date },
    cancelledBy:   { type: AuditStampSchema },
    cancelReason:  { type: String },

    createdBy: { type: AuditStampSchema },
  },
  { timestamps: true },
);

/* ─── Indexes ──────────────────────────────────────────────────────────────── */

/* Prevent double-invoicing the same order */
InvoiceSchema.index({ orderId: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ customerId: 1, createdAt: -1 });
InvoiceSchema.index({ guestToken: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 });
InvoiceSchema.index({ invoiceNumber: 1 });

export const InvoiceModel = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
