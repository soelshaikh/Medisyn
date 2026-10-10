import type { TaxLineItem } from '@/lib/tax-rates';

export const CANADIAN_PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

export type CanadianProvince = (typeof CANADIAN_PROVINCES)[number];

export { TaxLineItem };

export interface CheckoutAddress {
  street: string;
  unit?: string;
  city: string;
  province: CanadianProvince;
  postalCode: string;
  country: 'CA';
}

export interface CheckoutBreakdown {
  subtotal: string;
  taxBreakdown: TaxLineItem[];
  taxTotal: string;
  shippingCost: string;
  total: string;
}

export interface CheckoutPreviewInput {
  shippingAddress: CheckoutAddress;
  shippingMethodId: string;
}

export interface CheckoutPreviewResult {
  previewToken: string;
  previewTokenExpiresAt: string;
  cart: {
    itemCount: number;
    items: Array<{
      productId: string;
      variantId: string | null;
      productName: string;
      quantity: number;
      currentPrice: string;
      lineTotal: string;
    }>;
  };
  shippingAddress: CheckoutAddress;
  shippingMethod: {
    id: string;
    name: string;
    flatRate: string;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  };
  breakdown: CheckoutBreakdown;
}

export interface PlaceOrderInput {
  previewToken: string;
  shippingAddress: CheckoutAddress;
  shippingMethodId: string;
  notes?: string;
}

export interface PreviewTokenClaims {
  sub: string;
  facilityId: string;
  shippingMethodId: string;
  province: string;
  subtotal: string;
  taxTotal: string;
  shippingCost: string;
  total: string;
  iat: number;
  exp: number;
}
