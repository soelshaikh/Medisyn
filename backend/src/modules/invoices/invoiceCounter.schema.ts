import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceCounter extends Document {
  /* e.g. "E-26-27" or "A-26-27" */
  key:      string;
  lastSeq:  number;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>({
  key:     { type: String, required: true, unique: true },
  lastSeq: { type: Number, default: 0 },
});

export const InvoiceCounterModel = mongoose.model<IInvoiceCounter>("InvoiceCounter", InvoiceCounterSchema);
