import mongoose, { type Document, Schema, type Types } from "mongoose";

export type MovementType =
  | "batch_received"
  | "order_fulfilled"
  | "order_cancelled"
  | "manual_adjustment"
  | "batch_recalled"
  | "expired_writeoff";

export interface IInventoryMovement extends Document {
  productId:    Types.ObjectId;
  batchId:      Types.ObjectId;
  batchNumber:  string;
  movementType: MovementType;
  qty:          number; // positive = stock in, negative = stock out
  qtyBefore:    number;
  qtyAfter:     number;
  orderId:      Types.ObjectId | null;
  orderNumber:  string | null;
  performedBy:  Types.ObjectId | null;
  notes:        string;
  createdAt:    Date;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId:    { type: Schema.Types.ObjectId, ref: "Product", required: true },
    batchId:      { type: Schema.Types.ObjectId, ref: "ProductBatch", required: true },
    batchNumber:  { type: String, required: true },
    movementType: {
      type: String,
      enum: ["batch_received", "order_fulfilled", "order_cancelled", "manual_adjustment", "batch_recalled", "expired_writeoff"],
      required: true,
    },
    qty:         { type: Number, required: true },
    qtyBefore:   { type: Number, required: true },
    qtyAfter:    { type: Number, required: true },
    orderId:     { type: Schema.Types.ObjectId, ref: "Order", default: null },
    orderNumber: { type: String, default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes:       { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

InventoryMovementSchema.index({ productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ batchId: 1, createdAt: -1 });
InventoryMovementSchema.index({ orderId: 1 });
InventoryMovementSchema.index({ movementType: 1, createdAt: -1 });

export const InventoryMovementModel = mongoose.model<IInventoryMovement>(
  "InventoryMovement",
  InventoryMovementSchema,
);
