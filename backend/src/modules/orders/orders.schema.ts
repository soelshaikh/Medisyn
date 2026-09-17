import mongoose, { type Document, Schema, type Types } from "mongoose";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled";

export interface IOrderItem {
  productId: Types.ObjectId;
  name:      string;
  sku:       string;
  price:     number; // cents snapshot
  quantity:  number;
  lineTotal: number; // cents
}

export interface IShippingAddress {
  fullName:   string;
  phone:      string;
  address1:   string;
  address2:   string;
  city:       string;
  province:   string; // 2-letter CA code
  postalCode: string;
  country:    "CA";
}

export interface ITaxLine {
  name:   string;
  rate:   number;
  amount: number; // cents
}

export interface IStatusHistory {
  status:    OrderStatus;
  changedAt: Date;
  changedBy: Types.ObjectId | null; // null = system
  note:      string;
}

export interface IOrder extends Document {
  orderNumber:     string;
  userId:          Types.ObjectId | null;
  guestInfo:       { email: string; fullName: string; phone: string } | null;
  items:           IOrderItem[];
  shippingAddress: IShippingAddress;
  subtotal:        number; // cents
  taxBreakdown:    ITaxLine[];
  taxTotal:        number; // cents
  discountAmount:  number; // cents
  couponCode:      string | null;
  total:           number; // cents
  paymentMethod:   "pickup" | "delivery";
  status:          OrderStatus;
  statusHistory:   IStatusHistory[];
  notes:           string;
  adminNotes:      string;
  createdAt:       Date;
  updatedAt:       Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber:   { type: String, required: true, unique: true },
    userId:        { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    guestInfo:     {
      type: new Schema({ email: String, fullName: String, phone: String }, { _id: false }),
      default: null,
    },
    items: [{
      productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      name:      { type: String, required: true },
      sku:       { type: String, required: true },
      price:     { type: Number, required: true },
      quantity:  { type: Number, required: true, min: 1 },
      lineTotal: { type: Number, required: true },
    }],
    shippingAddress: {
      type: new Schema({
        fullName:   String, phone: String,
        address1:   String, address2: { type: String, default: "" },
        city:       String, province: String,
        postalCode: String, country:  { type: String, default: "CA" },
      }, { _id: false }),
      required: true,
    },
    subtotal:       { type: Number, required: true },
    taxBreakdown:   [{ name: String, rate: Number, amount: Number, _id: false }],
    taxTotal:       { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    couponCode:     { type: String, default: null },
    total:          { type: Number, required: true },
    paymentMethod:  { type: String, enum: ["pickup", "delivery"], required: true },
    status:         {
      type: String,
      enum: ["pending", "confirmed", "processing", "ready_for_pickup", "delivered", "cancelled"],
      default: "pending",
    },
    statusHistory: [{
      status:    { type: String, required: true },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note:      { type: String, default: "" },
      _id:       false,
    }],
    notes:      { type: String, default: "" },
    adminNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "guestInfo.email": 1 });

export const OrderModel = mongoose.model<IOrder>("Order", OrderSchema);
