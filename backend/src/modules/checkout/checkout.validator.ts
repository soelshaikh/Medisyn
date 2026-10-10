import { z } from 'zod';
import { CANADIAN_PROVINCES } from './checkout.types';

export const CheckoutAddressSchema = z.object({
  street: z.string().min(1),
  unit: z.string().optional(),
  city: z.string().min(1),
  province: z.enum(CANADIAN_PROVINCES),
  postalCode: z.string().min(1).max(10),
  country: z.literal('CA'),
});

export const CheckoutPreviewBodySchema = z.object({
  shippingAddress: CheckoutAddressSchema,
  shippingMethodId: z.string().uuid(),
});

export const PlaceOrderBodySchema = z.object({
  previewToken: z.string().min(1),
  shippingAddress: CheckoutAddressSchema,
  shippingMethodId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

export type CheckoutPreviewBody = z.infer<typeof CheckoutPreviewBodySchema>;
export type PlaceOrderBody = z.infer<typeof PlaceOrderBodySchema>;
