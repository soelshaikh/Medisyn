import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IProductBatch extends Document {
  productId:        Types.ObjectId;
  batchNumber:      string;
  expiryDate:       Date;
  manufacturedDate: Date | null;
  receivedDate:     Date;
  initialQty:       number;
  currentQty:       number;
  status:           "active" | "depleted" | "expired" | "recalled";
  notes:            string;
  recallReason:     string | null;
  recalledAt:       Date | null;
  recalledBy:       Types.ObjectId | null;
  supplier:         string | null;
  purchaseOrderRef: string | null;
  createdBy:        Types.ObjectId;
  createdAt:        Date;
  updatedAt:        Date;
}

const ProductBatchSchema = new Schema<IProductBatch>(
  {
    productId:        { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    batchNumber:      { type: String, required: true, trim: true },
    expiryDate:       { type: Date, required: true },
    manufacturedDate: { type: Date, default: null },
    receivedDate:     { type: Date, default: Date.now },
    initialQty:       { type: Number, required: true, min: 0 },
    currentQty:       { type: Number, required: true, min: 0 },
    status:           { type: String, enum: ["active", "depleted", "expired", "recalled"], default: "active" },
    notes:            { type: String, default: "" },
    recallReason:     { type: String, default: null },
    recalledAt:       { type: Date, default: null },
    recalledBy:       { type: Schema.Types.ObjectId, ref: "User", default: null },
    supplier:         { type: String, default: null },
    purchaseOrderRef: { type: String, default: null },
    createdBy:        { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

/* Batch number unique per product */
ProductBatchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });
/* FEFO query: active batches sorted by expiry */
ProductBatchSchema.index({ productId: 1, status: 1, expiryDate: 1 });
/* Near-expiry dashboard */
ProductBatchSchema.index({ expiryDate: 1, status: 1 });

export const ProductBatchModel = mongoose.model<IProductBatch>("ProductBatch", ProductBatchSchema);
