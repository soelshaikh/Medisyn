import { eq, sql, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { TenantTransaction } from '@/db';
import { carts, cartItems } from '@/db/schema/commerce';
import type { CartItemLive } from './cart.types';

// ── findCartByToken ───────────────────────────────────────────────────────

export async function findCartByToken(
  facilityId: string,
  cartToken: string,
  tx: TenantTransaction,
): Promise<typeof carts.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(carts)
    .where(and(eq(carts.facilityId, facilityId), eq(carts.cartToken, cartToken)))
    .limit(1);
  return row;
}

// ── findCartByUserId ──────────────────────────────────────────────────────

export async function findCartByUserId(
  facilityId: string,
  userId: string,
  tx: TenantTransaction,
): Promise<typeof carts.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(carts)
    .where(and(eq(carts.facilityId, facilityId), eq(carts.userId, userId)))
    .limit(1);
  return row;
}

// ── createCart ────────────────────────────────────────────────────────────

export async function createCart(
  data: {
    facilityId: string;
    userId?: string | null;
    cartToken?: string | null;
    expiresAt?: Date | null;
  },
  tx: TenantTransaction,
): Promise<typeof carts.$inferSelect> {
  const token = data.cartToken ?? (data.userId ? null : uuidv4());
  const [row] = await tx
    .insert(carts)
    .values({
      facilityId: data.facilityId,
      userId: data.userId ?? null,
      cartToken: token,
      expiresAt:
        data.expiresAt ??
        (data.userId ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    })
    .returning();
  return row;
}

// ── findCartItemsFull ─────────────────────────────────────────────────────
// Returns cart items with live product data (current price, stock, active status).
// Used for building the cart response and validating stock at checkout.

export async function findCartItemsFull(
  cartId: string,
  tx: TenantTransaction,
): Promise<CartItemLive[]> {
  const rows = await tx.execute(sql`
    SELECT
      ci.id,
      ci.cart_id                AS "cartId",
      ci.facility_id            AS "facilityId",
      ci.product_id             AS "productId",
      ci.variant_id             AS "variantId",
      ci.quantity,
      ci.price_snapshot         AS "priceSnapshot",
      ci.product_name_snapshot  AS "productNameSnapshot",
      ci.variant_label_snapshot AS "variantLabelSnapshot",
      ci.created_at             AS "createdAt",
      ci.updated_at             AS "updatedAt",
      COALESCE(pv.price, p.price)::text              AS "currentPrice",
      COALESCE(pv.dimension_value, NULL)             AS "variantLabel",
      COALESCE(pv.sku, p.sku)                        AS "sku",
      p.is_active                                    AS "isActive",
      COALESCE(ir.quantity, 0)                       AS "stockQuantity"
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    LEFT JOIN product_variants pv ON pv.id = ci.variant_id
    LEFT JOIN inventory_records ir
      ON ir.product_id = ci.product_id
      AND ir.variant_id IS NOT DISTINCT FROM ci.variant_id
    WHERE ci.cart_id = ${cartId}
    ORDER BY ci.created_at ASC
  `);
  return rows as unknown as CartItemLive[];
}

// ── findCartItemById ──────────────────────────────────────────────────────

export async function findCartItemById(
  itemId: string,
  cartId: string,
  tx: TenantTransaction,
): Promise<typeof cartItems.$inferSelect | undefined> {
  const [row] = await tx
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .limit(1);
  return row;
}

// ── findCartItemByProduct ─────────────────────────────────────────────────
// Find an existing line item for the same (cart, product, variant) combo.

export async function findCartItemByProduct(
  cartId: string,
  productId: string,
  variantId: string | null,
  tx: TenantTransaction,
): Promise<typeof cartItems.$inferSelect | undefined> {
  const condition =
    variantId === null
      ? and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, productId),
          isNull(cartItems.variantId),
        )
      : and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, productId),
          eq(cartItems.variantId, variantId),
        );
  const [row] = await tx.select().from(cartItems).where(condition).limit(1);
  return row;
}

// ── insertCartItem ────────────────────────────────────────────────────────

export async function insertCartItem(
  data: {
    cartId: string;
    facilityId: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    priceSnapshot: string;
    productNameSnapshot: string;
    variantLabelSnapshot: string | null;
  },
  tx: TenantTransaction,
): Promise<typeof cartItems.$inferSelect> {
  const [row] = await tx.insert(cartItems).values(data).returning();
  return row;
}

// ── updateCartItemQty ─────────────────────────────────────────────────────

export async function updateCartItemQty(
  itemId: string,
  newQty: number,
  tx: TenantTransaction,
): Promise<void> {
  await tx
    .update(cartItems)
    .set({ quantity: newQty, updatedAt: new Date() })
    .where(eq(cartItems.id, itemId));
}

// ── deleteCartItem ────────────────────────────────────────────────────────
// Returns number of rows affected (0 if item not found in cart).

export async function deleteCartItem(
  itemId: string,
  cartId: string,
  tx: TenantTransaction,
): Promise<number> {
  const result = await tx
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .returning({ id: cartItems.id });
  return result.length;
}

// ── deleteAllCartItems ────────────────────────────────────────────────────

export async function deleteAllCartItems(cartId: string, tx: TenantTransaction): Promise<void> {
  await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

// ── deleteCart ────────────────────────────────────────────────────────────

export async function deleteCart(cartId: string, tx: TenantTransaction): Promise<void> {
  await tx.delete(carts).where(eq(carts.id, cartId));
}

// ── countCartDistinctItems ────────────────────────────────────────────────

export async function countCartDistinctItems(
  cartId: string,
  tx: TenantTransaction,
): Promise<number> {
  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  return count;
}
