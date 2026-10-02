import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface IInventory extends Document {
  productId:            Types.ObjectId;
  quantity:             number;
  lowStockThreshold:    number;
  trackInventory:       boolean;
  allowBackorder:       boolean;
  batchTrackingEnabled: boolean;
  nearExpiryAlertDays:  number;
  updatedAt:            Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    productId:            { type: Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    quantity:             { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold:    { type: Number, default: 10, min: 0 },
    trackInventory:       { type: Boolean, default: true },
    allowBackorder:       { type: Boolean, default: false },
    batchTrackingEnabled: { type: Boolean, default: false },
    nearExpiryAlertDays:  { type: Number, default: 90, min: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

InventorySchema.index({ quantity: 1, lowStockThreshold: 1 });

export const InventoryModel = mongoose.model<IInventory>("Inventory", InventorySchema);
