import type { IInvoice } from "./invoice.schema";
import type { IInvoiceLineItem } from "./invoice_line_item.schema";

export type RenderableInvoice = IInvoice & { lineItems: IInvoiceLineItem[] };

function esc(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cad(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(d: Date | string | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function renderInvoiceHtml(inv: RenderableInvoice): string {
  const addr = inv.billingAddress;
  const addrLines = [
    esc(addr.addressLine1),
    addr.addressLine2 ? esc(addr.addressLine2) : null,
    `${esc(addr.city)}, ${esc(addr.province)}  ${esc(addr.postalCode)}`,
    esc(addr.country),
  ].filter(Boolean).join("<br>");

  const itemRows = inv.lineItems.map((item) => `
    <tr>
      <td class="desc">${esc(item.name)}<br><span class="sku">SKU: ${esc(item.sku)}</span></td>
      <td class="num">${item.quantity}</td>
      <td class="num">${cad(item.unitPrice)}</td>
      <td class="num">${cad(item.lineTotal)}</td>
    </tr>
  `).join("");

  const taxRows = inv.taxLines.map((t) => `
    <tr class="tax-row">
      <td colspan="3" class="label-right">${esc(t.label)}</td>
      <td class="num">${cad(t.amount)}</td>
    </tr>
  `).join("");

  const isCancelled = inv.status === "cancelled" || inv.status === "system_cancelled";
  const cancelledBanner = isCancelled ? `
    <div class="void-banner">CANCELLED${inv.cancelReason ? ` — ${esc(inv.cancelReason)}` : ""}</div>
  ` : "";

  const orderRef = inv.orderNumber ? `
    <tr><td class="meta-label">Order</td><td>${esc(inv.orderNumber)}</td></tr>
  ` : "";

  const couponRow = inv.discountAmount > 0 ? `
    <tr class="tax-row">
      <td colspan="3" class="label-right">Discount${inv.couponCode ? ` (${esc(inv.couponCode)})` : ""}</td>
      <td class="num discount">-${cad(inv.discountAmount)}</td>
    </tr>
  ` : "";

  const notesBlock = inv.notes ? `
    <div class="notes">
      <h4>Notes</h4>
      <p>${esc(inv.notes)}</p>
    </div>
  ` : "";

  const statusLabel = isCancelled ? "CANCELLED" : inv.status === "finalized" ? "Issued" : "Draft";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(inv.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1a202c;
    background: #fff;
    padding: 48px;
    line-height: 1.5;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 36px;
    padding-bottom: 24px;
    border-bottom: 2px solid #1677A8;
  }
  .brand-name { font-size: 24px; font-weight: 700; color: #1677A8; }
  .brand-sub  { font-size: 11px; color: #718096; margin-top: 2px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 22px; font-weight: 700; color: #1a202c; }
  .invoice-title .inv-num { font-size: 13px; color: #4a5568; margin-top: 4px; }
  .void-banner {
    background: #FEF2F2;
    color: #ef4444;
    border: 2px solid #ef4444;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 24px;
    letter-spacing: 1px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
  }
  .meta-block h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #718096;
    margin-bottom: 8px;
  }
  table.meta-table { width: 100%; border-collapse: collapse; }
  table.meta-table td { padding: 2px 0; font-size: 12px; vertical-align: top; }
  table.meta-table td.meta-label {
    font-weight: 600; color: #4a5568; width: 90px; padding-right: 8px;
  }
  .address-text { font-size: 12px; line-height: 1.7; color: #1a202c; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  table.items thead tr {
    background: #F7F9FB;
    border-bottom: 1px solid #E2E8F0;
  }
  table.items thead th {
    padding: 10px 14px;
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    color: #718096;
  }
  table.items th.num, table.items td.num { text-align: right; }
  table.items tbody tr {
    border-bottom: 1px solid #E2E8F0;
  }
  table.items tbody tr:last-child { border-bottom: none; }
  table.items td {
    padding: 10px 14px;
    font-size: 12px;
    vertical-align: top;
  }
  td.desc { color: #1a202c; font-weight: 500; }
  td.desc .sku { font-size: 10px; color: #718096; font-weight: 400; }
  .tax-row td { padding: 6px 14px; font-size: 12px; }
  .label-right { text-align: right; color: #4a5568; }
  .totals-section {
    border-top: 1px solid #E2E8F0;
  }
  tr.total-final td {
    padding-top: 10px;
    font-size: 14px;
    font-weight: 700;
    border-top: 2px solid #1a202c;
  }
  .num { text-align: right; }
  .discount { color: #22c55e; }
  .notes {
    margin-top: 32px;
    padding: 14px 16px;
    background: #F7F9FB;
    border-radius: 6px;
    border-left: 3px solid #1677A8;
  }
  .notes h4 {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: #718096; margin-bottom: 6px;
  }
  .notes p { font-size: 12px; color: #4a5568; }
  .footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #E2E8F0;
    text-align: center;
    font-size: 10px;
    color: #718096;
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="brand-name">MediSyn</div>
    <div class="brand-sub">Canadian Online Pharmacy</div>
  </div>
  <div class="invoice-title">
    <h1>INVOICE</h1>
    <div class="inv-num">${esc(inv.invoiceNumber)}</div>
  </div>
</div>

${cancelledBanner}

<div class="meta-grid">
  <div class="meta-block">
    <h4>Invoice Details</h4>
    <table class="meta-table">
      <tr><td class="meta-label">Date</td><td>${fmtDate(inv.issuedAt)}</td></tr>
      <tr><td class="meta-label">Type</td><td>${inv.type === "ecommerce" ? "Order Invoice" : "Direct Invoice"}</td></tr>
      ${orderRef}
      <tr><td class="meta-label">Status</td><td>${statusLabel}</td></tr>
    </table>
  </div>
  <div class="meta-block">
    <h4>Billed To</h4>
    <div class="address-text">
      <strong>${esc(inv.customerName)}</strong><br>
      ${esc(inv.customerEmail)}<br>
      ${addr.phone ? `${esc(addr.phone)}<br>` : ""}
      ${addrLines}
    </div>
  </div>
</div>

<table class="items">
  <thead>
    <tr>
      <th style="width:50%">Description</th>
      <th class="num">Qty</th>
      <th class="num">Unit Price</th>
      <th class="num">Total</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
  <tbody class="totals-section">
    <tr class="tax-row">
      <td colspan="3" class="label-right">Subtotal</td>
      <td class="num">${cad(inv.subtotal)}</td>
    </tr>
    ${couponRow}
    ${taxRows}
    <tr class="total-final">
      <td colspan="3" class="label-right">Total (CAD)</td>
      <td class="num">${cad(inv.total)}</td>
    </tr>
  </tbody>
</table>

${notesBlock}

<div class="footer">
  MediSyn Pharmacy &nbsp;·&nbsp; medisyn.ca &nbsp;·&nbsp; support@medisyn.ca
  <br>This invoice was generated electronically and is valid without a signature.
</div>

</body>
</html>`;
}
