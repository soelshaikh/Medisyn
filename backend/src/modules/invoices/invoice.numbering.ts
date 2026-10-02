import { config } from "@/config";
import { InvoiceCounterModel } from "./invoiceCounter.schema";
import type { InvoiceType } from "./invoice.schema";

/**
 * Returns the Canadian financial year string for a given date.
 * FY runs April 1 – March 31. A date in May 2026 → "26-27".
 */
export function financialYear(date: Date): string {
  /* Convert to the configured timezone offset — we only need the year/month,
     so a simple approach using Intl is sufficient. */
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.APP_TIMEZONE,
    year:  "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year  = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);

  const startYear = month >= 4 ? year : year - 1;
  const endYear   = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

/**
 * Atomically increments the sequence counter for a type+FY combination and
 * returns the formatted invoice number.
 *
 * Format: MP-{typeCode}-{FY}-{seq:05d}  (always 16 chars)
 *   e.g.: MP-E-26-27-00001
 */
export async function nextInvoiceNumber(type: InvoiceType, date: Date = new Date()): Promise<string> {
  const typeCode = type === "ecommerce" ? "E" : "A";
  const fy       = financialYear(date);
  const key      = `${typeCode}-${fy}`;

  const counter = await InvoiceCounterModel.findOneAndUpdate(
    { key },
    { $inc: { lastSeq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const seq = String(counter.lastSeq).padStart(5, "0");
  return `MP-${typeCode}-${fy}-${seq}`;
}
