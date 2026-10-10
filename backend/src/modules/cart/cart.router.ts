import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { authMiddleware } from '@/core/auth/auth.middleware';
import { resolveFacility } from '@/middleware/resolve-facility';
import { optionalAuth } from '@/middleware/optional-auth';
import { AppError } from '@/lib/errors';
import { withTenantContext } from '@/lib/tenant-context';
import {
  getOrCreateCart,
  resolveCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  mergeGuestCart,
  buildCartResponse,
} from './cart.service';
import {
  AddItemBodySchema,
  UpdateItemBodySchema,
  MergeCartBodySchema,
} from './cart.validator';

export const cartRouter = Router();

const CART_COOKIE = 'medisyn_cart';
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function zodError(err: ZodError): AppError {
  const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', msg, 422);
}

function getCartContext(req: Request): { userId: string | null; cartToken: string | null } {
  const userId = req.auth?.userId ?? null;
  const cartToken = (req.cookies as Record<string, string>)[CART_COOKIE] ?? null;
  return { userId, cartToken };
}

// ── GET /cart ─────────────────────────────────────────────────────────────
cartRouter.get(
  '/',
  resolveFacility,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const { userId, cartToken } = getCartContext(req);

      const result = await withTenantContext(facilityId, async (tx) => {
        const cart = await resolveCart(facilityId, userId, cartToken, tx);
        if (!cart) {
          return { id: null, facilityId, cartToken: null, itemCount: 0, items: [], subtotal: '0.00' };
        }
        return buildCartResponse(cart, tx);
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /cart/items ──────────────────────────────────────────────────────
cartRouter.post(
  '/items',
  resolveFacility,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const body = AddItemBodySchema.parse(req.body);
      const { userId, cartToken } = getCartContext(req);

      const result = await withTenantContext(facilityId, async (tx) => {
        const { cart, isNew } = await getOrCreateCart(facilityId, userId, cartToken, tx);
        await addItem(facilityId, cart, { productId: body.productId, variantId: body.variantId, quantity: body.quantity }, tx);
        return { cart, isNew };
      });

      // Set HttpOnly guest cart cookie for new guest carts
      if (result.isNew && !userId && result.cart.cartToken) {
        res.cookie(CART_COOKIE, result.cart.cartToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: COOKIE_MAX_AGE_MS,
        });
      }

      const cartData = await withTenantContext(facilityId, async (tx) =>
        buildCartResponse(result.cart, tx),
      );

      res.status(201).json({ data: cartData });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /cart/items/:id ─────────────────────────────────────────────────
cartRouter.patch(
  '/items/:id',
  resolveFacility,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const itemId = req.params.id as string;
      const body = UpdateItemBodySchema.parse(req.body);
      const { userId, cartToken } = getCartContext(req);

      const cartData = await withTenantContext(facilityId, async (tx) => {
        const cart = await resolveCart(facilityId, userId, cartToken, tx);
        if (!cart) throw new AppError('CART_ITEM_NOT_FOUND', 'Cart not found', 404);
        await updateItem(cart, itemId, { quantity: body.quantity }, tx);
        return buildCartResponse(cart, tx);
      });

      res.json({ data: cartData });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── DELETE /cart/items/:id ────────────────────────────────────────────────
cartRouter.delete(
  '/items/:id',
  resolveFacility,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const itemId = req.params.id as string;
      const { userId, cartToken } = getCartContext(req);

      const cartData = await withTenantContext(facilityId, async (tx) => {
        const cart = await resolveCart(facilityId, userId, cartToken, tx);
        if (!cart) throw new AppError('CART_ITEM_NOT_FOUND', 'Cart not found', 404);
        await removeItem(cart, itemId, tx);
        return buildCartResponse(cart, tx);
      });

      res.json({ data: cartData });
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /cart ──────────────────────────────────────────────────────────
cartRouter.delete(
  '/',
  resolveFacility,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const { userId, cartToken } = getCartContext(req);

      const cartData = await withTenantContext(facilityId, async (tx) => {
        const cart = await resolveCart(facilityId, userId, cartToken, tx);
        if (!cart) {
          return { id: null, facilityId, cartToken: null, itemCount: 0, items: [], subtotal: '0.00' };
        }
        await clearCart(cart.id, tx);
        return buildCartResponse(cart, tx);
      });

      res.json({ data: cartData });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /cart/merge ──────────────────────────────────────────────────────
cartRouter.post(
  '/merge',
  ...authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = MergeCartBodySchema.parse(req.body);
      const userId = req.auth!.userId;

      const cartData = await withTenantContext(facilityId, async (tx) => {
        const { cart } = await mergeGuestCart(facilityId, userId, body.cartToken, tx);
        return buildCartResponse(cart, tx);
      });

      // Clear the guest cookie after merge
      res.clearCookie(CART_COOKIE);
      res.json({ data: cartData });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);
