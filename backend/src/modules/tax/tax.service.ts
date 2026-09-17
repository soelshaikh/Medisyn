export interface TaxLine {
  name:   string;
  rate:   number;
  amount: number; // cents
}

export interface TaxResult {
  breakdown: TaxLine[];
  total:     number; // cents
}

/* Canadian tax rates — all amounts in cents, rates as decimals */
const PROVINCE_RATES: Record<string, Array<{ name: string; rate: number }>> = {
  AB: [{ name: "GST",  rate: 0.05 }],
  BC: [{ name: "GST",  rate: 0.05 }, { name: "PST", rate: 0.07 }],
  MB: [{ name: "GST",  rate: 0.05 }, { name: "RST", rate: 0.07 }],
  NB: [{ name: "HST",  rate: 0.15 }],
  NL: [{ name: "HST",  rate: 0.15 }],
  NS: [{ name: "HST",  rate: 0.15 }],
  NT: [{ name: "GST",  rate: 0.05 }],
  NU: [{ name: "GST",  rate: 0.05 }],
  ON: [{ name: "HST",  rate: 0.13 }],
  PE: [{ name: "HST",  rate: 0.15 }],
  QC: [{ name: "GST",  rate: 0.05 }, { name: "QST", rate: 0.09975 }],
  SK: [{ name: "GST",  rate: 0.05 }, { name: "PST", rate: 0.06 }],
  YT: [{ name: "GST",  rate: 0.05 }],
};

export function calculateTax(subtotalCents: number, province: string): TaxResult {
  const rates = PROVINCE_RATES[province.toUpperCase()];
  if (!rates) throw new Error(`Unknown province code: ${province}`);

  const breakdown: TaxLine[] = rates.map(({ name, rate }) => ({
    name,
    rate,
    amount: Math.round(subtotalCents * rate),
  }));

  return {
    breakdown,
    total: breakdown.reduce((sum, l) => sum + l.amount, 0),
  };
}

export const VALID_PROVINCES = Object.keys(PROVINCE_RATES);
