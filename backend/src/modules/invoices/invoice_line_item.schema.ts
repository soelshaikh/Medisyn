import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInvoiceLineItem extends Document {
  invoiceId:      Types.ObjectId;
  productId?:     Types.ObjectId; /* ref → products; undefined for adhoc custom items */

  /* Snapshot at invoice time — never recalculated from live product data */
  name:           string;
  sku:            string;
  description?:   string;

  quantity:       number;
  unitPrice:      number; /* cents */
  discountAmount: number; /* cents — per-line discount */
  lineTotal:      number; /* cents — (quantity × unitPrice) - discountAmount */

  sortOrder:      number; /* display ordering */

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    invoiceId:      { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
    productId:      { type: Schema.Types.ObjectId, ref: "Product", sparse: true },

    name:           { type: String, required: true },
    sku:            { type: String, required: true },
    description:    { type: String },

    quantity:       { type: Number, required: true, min: 1 },
    unitPrice:      { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    lineTotal:      { type: Number, required: true, min: 0 },

    sortOrder:      { type: Number, default: 0 },
  },
  { timestamps: true },
);

InvoiceLineItemSchema.index({ invoiceId: 1, sortOrder: 1 });

export const InvoiceLineItemModel = mongoose.model<IInvoiceLineItem>("InvoiceLineItem", InvoiceLineItemSchema);
