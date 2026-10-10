import { TenantTransaction } from '@/db';
import { carts } from '@/db/schema/commerce';
import { AppError } from '@/lib/errors';
import { getProductById, getVariantById } from '@/modules/catalogue/products/product.queries';
import {
  findCartByToken,
  findCartByUserId,
  createCart,
  findCartItemsFull,
  findCartItemById,
  findCartItemByProduct,
  insertCartItem,
  updateCartItemQty,
  deleteCartItem,
  deleteAllCartItems,
  deleteCart,
  countCartDistinctItems,
} from './cart.queries';
import type { CartResponse, CartItemResponse, AddItemInput, UpdateItemInput } from './cart.types';

type CartRow = typeof carts.$inferSelect;

const CART_ITEM_LIMIT = 50;

// ── buildCartResponse ─────────────────────────────────────────────────────
// Builds the public cart response from DB row data (uses live product price).

export async function buildCartResponse(
  cart: { id: string; facilityId: string; cartToken: string | null },
  tx: TenantTransaction,
): Promise<CartResponse> {
  const liveItems = await findCartItemsFull(cart.id, tx);

  const items: CartItemResponse[] = liveItems.map((item) => {
    const qty = item.quantity;
    const price = item.currentPrice;
    const lineTotal = (parseFloat(price) * qty).toFixed(2);
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.productNameSnapshot,
      variantLabel: item.variantLabel ?? item.variantLabelSnapshot,
      sku: item.sku,
      quantity: qty,
      priceSnapshot: item.priceSnapshot,
      currentPrice: price,
      lineTotal,
      stockQuantity: item.stockQuantity,
      isActive: item.isActive,
    };
  });

  const subtotal = items
    .reduce((sum, i) => sum + parseFloat(i.lineTotal), 0)
    .toFixed(2);

  return {
    id: cart.id,
    facilityId: cart.facilityId,
    cartToken: cart.cartToken,
    itemCount: items.length,
    items,
    subtotal,
  };
}

// ── resolveCart ───────────────────────────────────────────────────────────
// Finds an existing cart; does NOT create one if missing.

export async function resolveCart(
  facilityId: string,
  userId: string | null,
  cartToken: string | null,
  tx: TenantTransaction,
): Promise<CartRow | null> {
  if (userId) {
    return (await findCartByUserId(facilityId, userId, tx)) ?? null;
  }
  if (cartToken) {
    return (await findCartByToken(facilityId, cartToken, tx)) ?? null;
  }
  return null;
}

// ── getOrCreateCart ───────────────────────────────────────────────────────
// Finds or creates a cart; returns {cart, isNew}.

export async function getOrCreateCart(
  facilityId: string,
  userId: string | null,
  cartToken: string | null,
  tx: TenantTransaction,
): Promise<{ cart: CartRow; isNew: boolean }> {
  // Authenticated user: find or create auth cart
  if (userId) {
    const existing = await findCartByUserId(facilityId, userId, tx);
    if (existing) return { cart: existing, isNew: false };
    const cart = await createCart({ facilityId, userId, cartToken: null }, tx);
    return { cart, isNew: true };
  }

  // Guest: find by token if provided, otherwise create a new guest cart
  if (cartToken) {
    const existing = await findCartByToken(facilityId, cartToken, tx);
    if (existing) return { cart: existing, isNew: false };
  }

  const cart = await createCart({ facilityId, userId: null }, tx);
  return { cart, isNew: true };
}

// ── addItem ───────────────────────────────────────────────────────────────

export async function addItem(
  facilityId: string,
  cart: { id: string },
  input: AddItemInput,
  tx: TenantTransaction,
): Promise<void> {
  // Validate product exists and is active
  const product = await getProductById(input.productId, tx);
  if (!product || !product.isActive) {
    throw new AppError('PRODUCT_NOT_FOUND', 'Product not found or unavailable', 404);
  }

  // Validate variant if provided
  let variantPrice = product.price;
  let variantLabel: string | null = null;

  if (input.variantId) {
    const variant = await getVariantById(input.variantId, tx);
    if (!variant || variant.productId !== input.productId || !variant.isActive) {
      throw new AppError('VARIANT_NOT_FOUND', 'Variant not found or unavailable', 404);
    }
    variantPrice = variant.price;
    variantLabel = variant.dimensionValue;
  }

  // Cart item limit
  const existing = await findCartItemByProduct(
    cart.id,
    input.productId,
    input.variantId ?? null,
    tx,
  );
  if (!existing) {
    const count = await countCartDistinctItems(cart.id, tx);
    if (count >= CART_ITEM_LIMIT) {
      throw new AppError(
        'CART_ITEM_LIMIT_EXCEEDED',
        `Cart is limited to ${CART_ITEM_LIMIT} distinct items`,
        422,
      );
    }
  }

  // Upsert: if item exists, increment; if new, insert
  if (existing) {
    const newQty = existing.quantity + input.quantity;
    await updateCartItemQty(existing.id, newQty, tx);
  } else {
    await insertCartItem(
      {
        cartId: cart.id,
        facilityId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        quantity: input.quantity,
        priceSnapshot: variantPrice,
        productNameSnapshot: product.name,
        variantLabelSnapshot: variantLabel,
      },
      tx,
    );
  }
}

// ── updateItem ────────────────────────────────────────────────────────────

export async function updateItem(
  cart: { id: string },
  itemId: string,
  input: UpdateItemInput,
  tx: TenantTransaction,
): Promise<void> {
  const item = await findCartItemById(itemId, cart.id, tx);
  if (!item) {
    throw new AppError('CART_ITEM_NOT_FOUND', 'Cart item not found', 404);
  }
  await updateCartItemQty(itemId, input.quantity, tx);
}

// ── removeItem ────────────────────────────────────────────────────────────

export async function removeItem(
  cart: { id: string },
  itemId: string,
  tx: TenantTransaction,
): Promise<void> {
  const affected = await deleteCartItem(itemId, cart.id, tx);
  if (affected === 0) {
    throw new AppError('CART_ITEM_NOT_FOUND', 'Cart item not found', 404);
  }
}

// ── clearCart ─────────────────────────────────────────────────────────────

export async function clearCart(cartId: string, tx: TenantTransaction): Promise<void> {
  await deleteAllCartItems(cartId, tx);
}

// ── mergeGuestCart ────────────────────────────────────────────────────────
// Merges guest cart into auth cart, deletes guest cart.
// Max-qty rule: for overlapping items, take max(guestQty, authQty).

export async function mergeGuestCart(
  facilityId: string,
  userId: string,
  cartToken: string,
  tx: TenantTransaction,
): Promise<{ cart: CartRow }> {
  const guestCart = await findCartByToken(facilityId, cartToken, tx);
  if (!guestCart) {
    throw new AppError('CART_TOKEN_NOT_FOUND', 'Guest cart not found', 404);
  }

  // Find or create auth cart
  let authCart = await findCartByUserId(facilityId, userId, tx);
  if (!authCart) {
    authCart = await createCart({ facilityId, userId, cartToken: null }, tx);
  }

  const guestItems = await findCartItemsFull(guestCart.id, tx);

  for (const guestItem of guestItems) {
    const authItem = await findCartItemByProduct(
      authCart.id,
      guestItem.productId,
      guestItem.variantId,
      tx,
    );

    if (authItem) {
      // Max-qty rule: use whichever is larger
      const mergedQty = Math.max(guestItem.quantity, authItem.quantity);
      await updateCartItemQty(authItem.id, mergedQty, tx);
    } else {
      // Check cart limit before adding new item
      const count = await countCartDistinctItems(authCart.id, tx);
      if (count < CART_ITEM_LIMIT) {
        await insertCartItem(
          {
            cartId: authCart.id,
            facilityId,
            productId: guestItem.productId,
            variantId: guestItem.variantId,
            quantity: guestItem.quantity,
            priceSnapshot: guestItem.priceSnapshot,
            productNameSnapshot: guestItem.productNameSnapshot,
            variantLabelSnapshot: guestItem.variantLabelSnapshot,
          },
          tx,
        );
      }
    }
  }

  // Delete guest cart (cascade deletes items)
  await deleteAllCartItems(guestCart.id, tx);
  await deleteCart(guestCart.id, tx);

  return { cart: authCart };
}
