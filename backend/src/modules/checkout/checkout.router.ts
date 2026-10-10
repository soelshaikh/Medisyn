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
