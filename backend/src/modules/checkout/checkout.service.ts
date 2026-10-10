import * as jwt from 'jsonwebtoken';
import { TenantTransaction } from '@/db';
import { AppError } from '@/lib/errors';
import { calculateTax, sumTaxLines } from '@/lib/tax-rates';
import { resolveCart } from '@/modules/cart/cart.service';
import { findCartItemsFull } from '@/modules/cart/cart.queries';
import { findMethodById } from '@/modules/shipping-methods/shipping-method.queries';
import type {
  CheckoutPreviewInput,
  CheckoutPreviewResult,
  PreviewTokenClaims,
  PlaceOrderInput,
} from './checkout.types';

const PREVIEW_TOKEN_TTL_SEC = 15 * 60;

// ── verifyPreviewToken ────────────────────────────────────────────────────

export function verifyPreviewToken(token: string): PreviewTokenClaims {
  if (!token) throw new AppError('PREVIEW_TOKEN_REQUIRED', 'Preview token is required', 422);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new AppError('INTERNAL_ERROR', 'JWT secret not configured', 500);

  try {
    return jwt.verify(token, secret) as PreviewTokenClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('PREVIEW_TOKEN_EXPIRED', 'Checkout preview has expired. Please start again.', 422);
    }
    throw new AppError('PREVIEW_TOKEN_INVALID', 'Invalid checkout preview token', 422);
  }
}

// ── previewCheckout ───────────────────────────────────────────────────────
// Read-only: validates cart + totals, signs preview token. No DB writes.

export async function previewCheckout(
  facilityId: string,
  userId: string,
  input: CheckoutPreviewInput,
  tx: TenantTransaction,
): Promise<CheckoutPreviewResult> {
  // 1. Resolve cart — must exist and be non-empty
  const cart = await resolveCart(facilityId, userId, null, tx);
  if (!cart) {
    throw new AppError('CART_EMPTY', 'Your cart is empty', 422);
  }

  const liveItems = await findCartItemsFull(cart.id, tx);
  if (liveItems.length === 0) {
    throw new AppError('CART_EMPTY', 'Your cart is empty', 422);
  }

  // 2. Check stock for all items
  const outOfStockItems = liveItems
    .filter((item) => !item.isActive || item.stockQuantity < item.quantity)
    .map((item) => item.productId);

  if (outOfStockItems.length > 0) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      'One or more items are out of stock or unavailable',
      422,
    );
  }

  // 3. Validate shipping method
  const method = await findMethodById(input.shippingMethodId, tx);
  if (!method || !method.isActive) {
    throw new AppError('SHIPPING_METHOD_NOT_FOUND', 'Shipping method not found or unavailable', 404);
  }

  // 4. Calculate totals server-side
  const subtotal = liveItems
    .reduce((sum, item) => sum + parseFloat(item.currentPrice) * item.quantity, 0)
    .toFixed(2);

  const taxLines = calculateTax(subtotal, input.shippingAddress.province);
  const taxTotal = sumTaxLines(taxLines);
  const shippingCost = method.flatRate;
  const total = (
    parseFloat(subtotal) + parseFloat(taxTotal) + parseFloat(shippingCost)
  ).toFixed(2);

  // 5. Sign preview token (15 min expiry)
  const secret = process.env.JWT_SECRET!;
  const expiresAt = new Date(Date.now() + PREVIEW_TOKEN_TTL_SEC * 1000);
  const previewToken = jwt.sign(
    {
      sub: userId,
      facilityId,
      shippingMethodId: input.shippingMethodId,
      province: input.shippingAddress.province,
      subtotal,
      taxTotal,
      shippingCost,
      total,
    } satisfies Omit<PreviewTokenClaims, 'iat' | 'exp'>,
    secret,
    { expiresIn: PREVIEW_TOKEN_TTL_SEC },
  );

  return {
    previewToken,
    previewTokenExpiresAt: expiresAt.toISOString(),
    cart: {
      itemCount: liveItems.length,
      items: liveItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productNameSnapshot,
        quantity: item.quantity,
        currentPrice: item.currentPrice,
        lineTotal: (parseFloat(item.currentPrice) * item.quantity).toFixed(2),
      })),
    },
    shippingAddress: input.shippingAddress,
    shippingMethod: {
      id: method.id,
      name: method.name,
      flatRate: method.flatRate,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
    },
    breakdown: {
      subtotal,
      taxBreakdown: taxLines,
      taxTotal,
      shippingCost,
      total,
    },
  };
}

export type { PlaceOrderInput };
