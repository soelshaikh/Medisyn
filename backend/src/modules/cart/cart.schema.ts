import mongoose, { type Document, Schema, type Types } from "mongoose";

export interface ICartItem {
  productId:  Types.ObjectId;
  name:       string; // snapshot
  sku:        string; // snapshot
  price:      number; // cents snapshot at time of add
  quantity:   number;
}

export interface ICart extends Document {
  sessionId:          string | null; // guest
  userId:             Types.ObjectId | null; // auth
  items:              ICartItem[];
  appliedCouponCode:  string | null;
  expiresAt:          Date;
  updatedAt:          Date;
}

const CartSchema = new Schema<ICart>(
  {
    sessionId:         { type: String, default: null, index: true },
    userId:            { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    items: [{
      productId:  { type: Schema.Types.ObjectId, ref: "Product", required: true },
      name:       { type: String, required: true },
      sku:        { type: String, required: true },
      price:      { type: Number, required: true },
      quantity:   { type: Number, required: true, min: 1 },
    }],
    appliedCouponCode: { type: String, default: null },
    expiresAt:         { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

/* TTL index — MongoDB auto-deletes expired carts */
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CartModel = mongoose.model<ICart>("Cart", CartSchema);
