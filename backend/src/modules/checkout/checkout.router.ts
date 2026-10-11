import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { AppError } from '@/lib/errors';
import { withTenantContext } from '@/lib/tenant-context';
import { previewCheckout } from './checkout.service';
import { CheckoutPreviewBodySchema, PlaceOrderBodySchema } from './checkout.validator';
import { placeOrder } from '@/modules/orders/order.service';

export const checkoutRouter = Router();

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

/**
 * @openapi
 * /checkout/preview:
 *   post:
 *     tags: [Commerce]
 *     summary: Preview order totals and get a preview token
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shippingAddress, shippingMethodId]
 *             properties:
 *               shippingMethodId: { type: string, format: uuid }
 *               shippingAddress:
 *                 type: object
 *                 required: [street, city, province, postalCode, country]
 *                 properties:
 *                   street: { type: string }
 *                   unit: { type: string }
 *                   city: { type: string }
 *                   province: { type: string }
 *                   postalCode: { type: string }
 *                   country: { type: string, enum: [CA] }
 *     responses:
 *       200:
 *         description: Checkout preview with totals and signed preview token
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: Cart empty or stock insufficient
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// ── POST /checkout/preview ────────────────────────────────────────────────
checkoutRouter.post(
  '/checkout/preview',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const body = CheckoutPreviewBodySchema.parse(req.body);
      const userId = req.auth!.userId;

      const result = await withTenantContext(facilityId, async (tx) => {
        return previewCheckout(facilityId, userId, { shippingAddress: body.shippingAddress, shippingMethodId: body.shippingMethodId }, tx);
      });

      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

/**
 * @openapi
 * /checkout/place:
 *   post:
 *     tags: [Commerce]
 *     summary: Place an order using a preview token
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [previewToken, shippingAddress, shippingMethodId]
 *             properties:
 *               previewToken: { type: string }
 *               shippingMethodId: { type: string, format: uuid }
 *               notes: { type: string, maxLength: 1000 }
 *               shippingAddress:
 *                 type: object
 *                 required: [street, city, province, postalCode, country]
 *                 properties:
 *                   street: { type: string }
 *                   city: { type: string }
 *                   province: { type: string }
 *                   postalCode: { type: string }
 *                   country: { type: string, enum: [CA] }
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId: { type: string, format: uuid }
 *                     orderNumber: { type: string }
 *                     status: { type: string, enum: [pending] }
 *                     total: { type: string }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: Preview token invalid/expired or validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// ── POST /checkout/place ──────────────────────────────────────────────────
checkoutRouter.post(
  '/checkout/place',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) return next(new AppError('FORBIDDEN', 'No facility context', 403));
      const body = PlaceOrderBodySchema.parse(req.body);
      const result = await placeOrder(
        { previewToken: body.previewToken, shippingAddress: body.shippingAddress, shippingMethodId: body.shippingMethodId, notes: body.notes },
        req.auth!,
      );
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
