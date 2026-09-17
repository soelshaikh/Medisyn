import { OrderModel, type IShippingAddress, type OrderStatus } from "./orders.schema";
import { CartModel } from "@/modules/cart/cart.schema";
import { ProductModel } from "@/modules/products/products.schema";
import { deductStock } from "@/modules/inventory/inventory.service";
import { validateCoupon, incrementUsage } from "@/modules/coupons/coupons.service";
import { calculateTax } from "@/modules/tax/tax.service";
import { AppError } from "@/common/middleware/error.middleware";
import { EmailService } from "@/modules/email/email.service";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

async function generateOrderNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await OrderModel.countDocuments();
  const seq   = String(count + 1).padStart(6, "0");
  return `ORD-${year}-${seq}`;
}

export interface CheckoutInput {
  shippingAddress: IShippingAddress;
  paymentMethod:   "pickup" | "delivery";
  notes?:          string;
  userId?:         string;
  sessionId?:      string;
  guestInfo?:      { email: string; fullName: string; phone: string };
}

export async function checkout(input: CheckoutInput) {
  const { userId, sessionId, shippingAddress, paymentMethod, notes, guestInfo } = input;

  const cart = await CartModel.findOne(userId ? { userId } : { sessionId });
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400);

  const productIds = cart.items.map((i) => i.productId);
  const products   = await ProductModel.find({ _id: { $in: productIds }, status: "active" });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const items = cart.items.map((cartItem) => {
    const product = productMap.get(String(cartItem.productId));
    if (!product) throw new AppError(`Product ${cartItem.name} is no longer available`, 400);
    return {
      productId: cartItem.productId,
      name:      product.name,
      sku:       product.sku,
      price:     product.price,
      quantity:  cartItem.quantity,
      lineTotal: product.price * cartItem.quantity,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  let discountAmount = 0;
  let couponCode: string | null = null;
  if (cart.appliedCouponCode) {
    const cartProductIds = items.map((i) => String(i.productId));
    const result = await validateCoupon(cart.appliedCouponCode, subtotal, userId, cartProductIds);
    if (result.valid) {
      discountAmount = result.discountCents ?? 0;
      couponCode     = cart.appliedCouponCode;
    }
  }

  const taxableAmount = subtotal - discountAmount;
  const tax           = calculateTax(taxableAmount, shippingAddress.province);
  const total         = taxableAmount + tax.total;

  await deductStock(items.map((i) => ({ productId: String(i.productId), quantity: i.quantity })));

  const orderNumber = await generateOrderNumber();
  const order = await OrderModel.create({
    orderNumber,
    userId:     userId ?? null,
    guestInfo:  userId ? null : guestInfo,
    items,
    shippingAddress,
    subtotal,
    taxBreakdown:  tax.breakdown,
    taxTotal:      tax.total,
    discountAmount,
    couponCode,
    total,
    paymentMethod,
    notes:         notes ?? "",
    status:        "pending",
    statusHistory: [{ status: "pending", changedAt: new Date(), changedBy: null, note: "Order placed" }],
  });

  if (couponCode) await incrementUsage(couponCode);

  await CartModel.findByIdAndDelete(cart._id);

  const email     = userId ? undefined : guestInfo?.email;
  const fullName  = userId ? undefined : guestInfo?.fullName;
  const totalStr  = `$${(total / 100).toFixed(2)} CAD`;

  if (email && fullName) {
    EmailService.sendOrderConfirmedEmail(
      { email, fullName },
      orderNumber,
      totalStr,
    ).catch(() => null);
  }

  await logAction({
    userId:     userId ?? null,
    userEmail:  userId ? undefined : guestInfo?.email,
    actorName:  userId ? undefined : (guestInfo?.fullName ?? "guest"),
    action:     "order.create",
    resource:   "order",
    resourceId: String(order._id),
    before:     null,
    after:      { orderNumber, total, status: "pending", itemCount: items.length },
  });

  return order;
}

export async function listUserOrders(userId: string, page = 1, limit = 20) {
  const [total, data] = await Promise.all([
    OrderModel.countDocuments({ userId }),
    OrderModel.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getOrder(id: string, userId?: string) {
  const query: Record<string, unknown> = { _id: id };
  if (userId) query.userId = userId;
  const order = await OrderModel.findOne(query).lean();
  if (!order) throw new AppError("Order not found", 404);
  return order;
}

export async function listAdminOrders(filters: {
  status?: string; search?: string; page?: number; limit?: number;
  dateFrom?: Date; dateTo?: Date;
} = {}) {
  const { status, search, page = 1, limit = 25, dateFrom, dateTo } = filters;
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) (query.createdAt as Record<string, Date>).$gte = dateFrom;
    if (dateTo)   (query.createdAt as Record<string, Date>).$lte = dateTo;
  }
  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "guestInfo.email": { $regex: search, $options: "i" } },
    ];
  }
  const [total, data] = await Promise.all([
    OrderModel.countDocuments(query),
    OrderModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function updateOrderStatus(
  id: string, status: OrderStatus, note: string, changedBy: string, actor?: AuditActor,
) {
  const order = await OrderModel.findById(id);
  if (!order) throw new AppError("Order not found", 404);

  const oldStatus = order.status;

  order.status = status;
  order.statusHistory.push({
    status,
    changedAt: new Date(),
    changedBy: changedBy as unknown as import("mongoose").Types.ObjectId,
    note,
  });

  const saved = await order.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     `order.status.${status}`,
    resource:   "order",
    resourceId: id,
    before:     { status: oldStatus },
    after:      { status },
    details:    { note },
    ipAddress:  actor?.ip,
  });

  return saved;
}

export async function addAdminNote(id: string, note: string, actor?: AuditActor) {
  const order = await OrderModel.findById(id);
  if (!order) throw new AppError("Order not found", 404);

  const oldNotes = order.adminNotes ?? "";
  order.adminNotes = oldNotes
    ? `${oldNotes}\n\n${new Date().toISOString()}: ${note}`
    : `${new Date().toISOString()}: ${note}`;
  const saved = await order.save();

  await logAction({
    userId:     actor?.id,
    userEmail:  actor?.email,
    actorName:  actor?.name,
    action:     "order.note.added",
    resource:   "order",
    resourceId: id,
    details:    { note },
    ipAddress:  actor?.ip,
  });

  return saved;
}
