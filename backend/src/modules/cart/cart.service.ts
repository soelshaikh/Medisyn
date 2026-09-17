import { CartModel } from "./cart.schema";
import { ProductModel } from "@/modules/products/products.schema";
import { InventoryModel } from "@/modules/inventory/inventory.schema";
import { validateCoupon } from "@/modules/coupons/coupons.service";
import { AppError } from "@/common/middleware/error.middleware";

function refreshExpiry() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/* Resolve cart by userId (auth) or sessionId (guest) */
async function resolveCart(userId?: string, sessionId?: string) {
  if (userId) return CartModel.findOne({ userId });
  if (sessionId) return CartModel.findOne({ sessionId });
  return null;
}

export async function getCart(userId?: string, sessionId?: string) {
  return (await resolveCart(userId, sessionId)) ?? null;
}

export async function getCartSummary(userId?: string, sessionId?: string) {
  const cart = await resolveCart(userId, sessionId);
  if (!cart || cart.items.length === 0) {
    return { items: [], subtotal: 0, discountAmount: 0, couponCode: null, total: 0 };
  }

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discountAmount = 0;

  if (cart.appliedCouponCode) {
    const cartProductIds = cart.items.map((i) => String(i.productId));
    const result = await validateCoupon(cart.appliedCouponCode, subtotal, userId, cartProductIds);
    if (result.valid) discountAmount = result.discountCents ?? 0;
    else cart.appliedCouponCode = null; // coupon no longer valid — clear it
  }

  return {
    items:          cart.items,
    subtotal,
    discountAmount,
    couponCode:     cart.appliedCouponCode,
    total:          subtotal - discountAmount,
  };
}

export async function addItem(
  productId: string, quantity: number,
  userId?: string, sessionId?: string,
) {
  const product = await ProductModel.findOne({ _id: productId, status: "active" });
  if (!product) throw new AppError("Product not found or unavailable", 404);

  /* Check stock */
  const inv = await InventoryModel.findOne({ productId });
  if (inv?.trackInventory && !inv.allowBackorder && inv.quantity < quantity) {
    throw new AppError("Insufficient stock", 409);
  }

  let cart = await resolveCart(userId, sessionId);

  if (!cart) {
    cart = await CartModel.create({
      userId:    userId    ?? null,
      sessionId: sessionId ?? null,
      items:     [],
      expiresAt: refreshExpiry(),
    });
  }

  const existing = cart.items.find((i) => String(i.productId) === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      productId:  product._id,
      name:       product.name,
      sku:        product.sku,
      price:      product.price,
      quantity,
    });
  }

  cart.expiresAt = refreshExpiry();
  return cart.save();
}

export async function updateItem(
  productId: string, quantity: number,
  userId?: string, sessionId?: string,
) {
  const cart = await resolveCart(userId, sessionId);
  if (!cart) throw new AppError("Cart not found", 404);

  if (quantity === 0) {
    cart.items = cart.items.filter((i) => String(i.productId) !== productId) as typeof cart.items;
  } else {
    const item = cart.items.find((i) => String(i.productId) === productId);
    if (!item) throw new AppError("Item not in cart", 404);
    item.quantity = quantity;
  }

  cart.expiresAt = refreshExpiry();
  return cart.save();
}

export async function removeItem(productId: string, userId?: string, sessionId?: string) {
  const cart = await resolveCart(userId, sessionId);
  if (!cart) throw new AppError("Cart not found", 404);
  cart.items = cart.items.filter((i) => String(i.productId) !== productId) as typeof cart.items;
  return cart.save();
}

export async function applyCoupon(code: string, userId?: string, sessionId?: string) {
  const cart = await resolveCart(userId, sessionId);
  if (!cart || cart.items.length === 0) throw new AppError("Cart is empty", 400);

  const subtotal      = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartProductIds = cart.items.map((i) => String(i.productId));
  const result = await validateCoupon(code, subtotal, userId, cartProductIds);
  if (!result.valid) throw new AppError(result.error ?? "Invalid coupon", 400);

  cart.appliedCouponCode = code.toUpperCase();
  return cart.save();
}

export async function removeCoupon(userId?: string, sessionId?: string) {
  const cart = await resolveCart(userId, sessionId);
  if (!cart) throw new AppError("Cart not found", 404);
  cart.appliedCouponCode = null;
  return cart.save();
}

export async function mergeGuestCart(userId: string, sessionId: string) {
  const [userCart, guestCart] = await Promise.all([
    CartModel.findOne({ userId }),
    CartModel.findOne({ sessionId }),
  ]);

  if (!guestCart || guestCart.items.length === 0) return userCart;

  if (!userCart) {
    /* Claim the guest cart */
    guestCart.userId    = userId as unknown as import("mongoose").Types.ObjectId;
    guestCart.sessionId = null;
    return guestCart.save();
  }

  /* Merge guest items into user cart */
  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find((i) => String(i.productId) === String(guestItem.productId));
    if (existing) existing.quantity += guestItem.quantity;
    else userCart.items.push(guestItem);
  }

  await CartModel.findByIdAndDelete(guestCart._id);
  userCart.expiresAt = refreshExpiry();
  return userCart.save();
}

export async function clearCart(userId?: string, sessionId?: string) {
  await CartModel.findOneAndDelete(
    userId ? { userId } : { sessionId }
  );
}
