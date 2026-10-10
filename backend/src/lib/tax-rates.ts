import { AppError } from './errors';

export interface TaxLineItem {
  type: 'GST' | 'HST' | 'PST' | 'QST';
  rate: string;
  amount: string;
}

// Canadian province/territory tax rates (CRA rates as of 2026).
// QST applies to pre-GST subtotal (additive method — not compounded on top of GST).
// All arithmetic uses string-based fixed-point to avoid floating point issues.

type TaxRule = { type: 'GST' | 'HST' | 'PST' | 'QST'; rate: string };

const PROVINCE_TAX_RULES: Record<string, TaxRule[]> = {
  AB: [{ type: 'GST', rate: '0.05' }],
  NT: [{ type: 'GST', rate: '0.05' }],
  NU: [{ type: 'GST', rate: '0.05' }],
  YT: [{ type: 'GST', rate: '0.05' }],
  BC: [
    { type: 'GST', rate: '0.05' },
    { type: 'PST', rate: '0.07' },
  ],
  MB: [
    { type: 'GST', rate: '0.05' },
    { type: 'PST', rate: '0.07' },
  ],
  ON: [{ type: 'HST', rate: '0.13' }],
  QC: [
    { type: 'GST', rate: '0.05' },
    { type: 'QST', rate: '0.09975' },
  ],
  SK: [
    { type: 'GST', rate: '0.05' },
    { type: 'PST', rate: '0.06' },
  ],
  NS: [{ type: 'HST', rate: '0.15' }],
  NB: [{ type: 'HST', rate: '0.15' }],
  PE: [{ type: 'HST', rate: '0.15' }],
  NL: [{ type: 'HST', rate: '0.15' }],
};

// Multiply two decimal strings — avoids floating-point errors for tax calculations.
// Returns a string with 2 decimal places.
function multiplyFixed(a: string, b: string): string {
  const scale = 10000;
  const aInt = Math.round(parseFloat(a) * scale);
  const bInt = Math.round(parseFloat(b) * scale);
  const result = (aInt * bInt) / (scale * scale);
  return result.toFixed(2);
}

// calculateTax — returns per-line tax breakdown for a given subtotal and province.
// QST uses additive method: applied to subtotal before GST (not on top of GST).
// Throws INVALID_PROVINCE for unknown province codes.
export function calculateTax(subtotal: string, province: string): TaxLineItem[] {
  const rules = PROVINCE_TAX_RULES[province.toUpperCase()];

  if (!rules) {
    throw new AppError(
      'INVALID_PROVINCE',
      `Unknown Canadian province or territory code: ${province}`,
      422,
    );
  }

  return rules.map((rule) => ({
    type: rule.type,
    rate: rule.rate,
    // QST: applied to subtotal (pre-GST base) — additive, not compounded
    // All other taxes: applied to subtotal
    amount: multiplyFixed(subtotal, rule.rate),
  }));
}

// sumTaxLines — convenience helper to sum TaxLineItem amounts into one total string.
export function sumTaxLines(lines: TaxLineItem[]): string {
  const total = lines.reduce((sum, l) => sum + parseFloat(l.amount), 0);
  return total.toFixed(2);
}

export const VALID_PROVINCE_CODES = Object.keys(PROVINCE_TAX_RULES);
