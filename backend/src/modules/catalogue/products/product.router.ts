import { Router, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { z } from 'zod';
import { authMiddleware, requirePermission } from '@/core/auth/auth.middleware';
import { resolveFacility } from '@/middleware/resolve-facility';
import { AppError } from '@/lib/errors';
import { withTenantContext } from '@/lib/tenant-context';
import { listProducts, type ProductSortKey } from './product.queries';
import {
  CreateProductBodySchema,
  UpdateProductBodySchema,
  CreateVariantBodySchema,
  UpdateVariantBodySchema,
} from './product.validator';
import {
  createProduct,
  updateProduct,
  deactivateProduct,
  addVariant,
  updateVariant,
  deactivateVariant,
  getProductDetail,
} from './product.service';

export const productRouter = Router();

function zodError(err: ZodError): AppError {
  const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  return new AppError('VALIDATION_ERROR', message, 422);
}

const ListProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category_id: z.string().uuid().optional(),
  brand: z.string().optional(),
  price_min: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  price_max: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  in_stock: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  featured: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
  sort: z
    .enum(['created_desc', 'price_asc', 'price_desc', 'name_asc', 'name_desc'])
    .default('created_desc'),
});

// ── GET /products (public) ────────────────────────────────────────────────
productRouter.get(
  '/',
  resolveFacility,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const query = ListProductsQuerySchema.parse(req.query);

      const { rows, total } = await withTenantContext(facilityId, (tx) =>
        listProducts(
          {
            page: query.page,
            limit: query.limit,
            categoryId: query.category_id,
            brand: query.brand,
            priceMin: query.price_min,
            priceMax: query.price_max,
            inStock: query.in_stock,
            featured: query.featured,
            search: query.search,
            sort: query.sort as ProductSortKey,
          },
          tx,
        ),
      );

      res.json({
        data: rows,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── GET /products/:id (public) ────────────────────────────────────────────
productRouter.get(
  '/:id',
  resolveFacility,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = res.locals.facilityId as string;
      const data = await getProductDetail(facilityId, req.params.id as string);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /products (admin) ────────────────────────────────────────────────
productRouter.post(
  '/',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = CreateProductBodySchema.parse(req.body);
      const result = await createProduct(facilityId, req.auth!.userId, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /products/:id (admin) ───────────────────────────────────────────
productRouter.patch(
  '/:id',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = UpdateProductBodySchema.parse(req.body);
      const result = await updateProduct(facilityId, req.auth!.userId, req.params.id as string, body);
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── DELETE /products/:id (admin) — soft deactivate ────────────────────────
productRouter.delete(
  '/:id',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const result = await deactivateProduct(facilityId, req.auth!.userId, req.params.id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /products/:id/variants (admin) ───────────────────────────────────
productRouter.post(
  '/:id/variants',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = CreateVariantBodySchema.parse(req.body);
      const result = await addVariant(facilityId, req.auth!.userId, req.params.id as string, body);
      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── PATCH /products/:id/variants/:variantId (admin) ───────────────────────
productRouter.patch(
  '/:id/variants/:variantId',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const body = UpdateVariantBodySchema.parse(req.body);
      const result = await updateVariant(
        facilityId,
        req.auth!.userId,
        req.params.id as string,
        req.params.variantId as string,
        body,
      );
      res.json({ data: result });
    } catch (err) {
      if (err instanceof ZodError) return next(zodError(err));
      next(err);
    }
  },
);

// ── DELETE /products/:id/variants/:variantId (admin) — soft deactivate ────
productRouter.delete(
  '/:id/variants/:variantId',
  ...authMiddleware,
  requirePermission('products.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = req.auth!.facilityId;
      if (!facilityId) {
        return next(new AppError('FORBIDDEN', 'No facility context in token', 403));
      }
      const result = await deactivateVariant(
        facilityId,
        req.auth!.userId,
        req.params.id as string,
        req.params.variantId as string,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);
