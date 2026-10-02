import { Types } from "mongoose";
import { InvoiceModel } from "./invoice.schema";
import { InvoiceLineItemModel, type IInvoiceLineItem } from "./invoice_line_item.schema";
import { InvoiceLineItemHistoryModel } from "./invoice_line_item_history.schema";
import { AppError } from "@/common/middleware/error.middleware";

export interface AuditActor {
  id:    string;
  name:  string;
  email: string;
}

export interface LineItemInput {
  productId?:     string;
  name:           string;
  sku:            string;
  description?:   string;
  quantity:       number;
  unitPrice:      number;
  discountAmount?: number;
}

/* ─── Guard: only allow line item mutations on draft invoices ──────────────── */

async function assertDraft(invoiceId: string): Promise<void> {
  const inv = await InvoiceModel.findById(invoiceId).select("status").lean();
  if (!inv)                  throw new AppError("Invoice not found", 404);
  if (inv.status !== "draft") throw new AppError("Line items can only be edited on draft invoices", 409);
}

/* ─── Recalculate invoice totals from current line items ──────────────────── */

export async function recalculateInvoiceTotals(invoiceId: string): Promise<void> {
  const items = await InvoiceLineItemModel.find({ invoiceId }).lean();

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  const invoice = await InvoiceModel.findById(invoiceId);
  if (!invoice) return;

  const discountAmount = invoice.discountAmount;
  const taxTotal       = invoice.taxLines.reduce((s, t) => s + t.amount, 0);
  const total          = Math.max(0, subtotal - discountAmount + taxTotal);
  const amountDue      = Math.max(0, total - invoice.amountPaid);

  await InvoiceModel.updateOne(
    { _id: invoiceId },
    { $set: { subtotal, taxTotal, total, amountDue } },
  );
}

/* ─── addLineItem ──────────────────────────────────────────────────────────── */

export async function addLineItem(
  invoiceId: string,
  input:     LineItemInput,
  actor:     AuditActor,
): Promise<IInvoiceLineItem> {
  await assertDraft(invoiceId);

  const discountAmount = input.discountAmount ?? 0;
  const lineTotal      = Math.max(0, input.quantity * input.unitPrice - discountAmount);

  const maxOrder = await InvoiceLineItemModel.findOne({ invoiceId })
    .sort({ sortOrder: -1 }).select("sortOrder").lean();
  const sortOrder = (maxOrder?.sortOrder ?? -1) + 1;

  const item = await InvoiceLineItemModel.create({
    invoiceId:     new Types.ObjectId(invoiceId),
    productId:     input.productId ? new Types.ObjectId(input.productId) : undefined,
    name:          input.name,
    sku:           input.sku,
    description:   input.description,
    quantity:      input.quantity,
    unitPrice:     input.unitPrice,
    discountAmount,
    lineTotal,
    sortOrder,
  });

  await InvoiceLineItemHistoryModel.create({
    lineItemId: item._id,
    invoiceId:  new Types.ObjectId(invoiceId),
    action:     "created",
    before:     null,
    after:      item.toObject(),
    changedBy:  { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email },
    changedAt:  new Date(),
  });

  await recalculateInvoiceTotals(invoiceId);

  return item;
}

/* ─── updateLineItem ───────────────────────────────────────────────────────── */

export async function updateLineItem(
  invoiceId: string,
  itemId:    string,
  input:     Partial<LineItemInput>,
  actor:     AuditActor,
): Promise<IInvoiceLineItem> {
  await assertDraft(invoiceId);

  const item = await InvoiceLineItemModel.findOne({ _id: itemId, invoiceId });
  if (!item) throw new AppError("Line item not found", 404);

  const before = item.toObject();

  if (input.name          !== undefined) item.name          = input.name;
  if (input.sku           !== undefined) item.sku           = input.sku;
  if (input.description   !== undefined) item.description   = input.description;
  if (input.productId     !== undefined) item.productId     = new Types.ObjectId(input.productId);
  if (input.quantity      !== undefined) item.quantity      = input.quantity;
  if (input.unitPrice     !== undefined) item.unitPrice     = input.unitPrice;
  if (input.discountAmount !== undefined) item.discountAmount = input.discountAmount;

  item.lineTotal = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);

  await item.save();

  await InvoiceLineItemHistoryModel.create({
    lineItemId: item._id,
    invoiceId:  new Types.ObjectId(invoiceId),
    action:     "updated",
    before,
    after:      item.toObject(),
    changedBy:  { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email },
    changedAt:  new Date(),
  });

  await recalculateInvoiceTotals(invoiceId);

  return item;
}

/* ─── deleteLineItem ───────────────────────────────────────────────────────── */

export async function deleteLineItem(
  invoiceId: string,
  itemId:    string,
  actor:     AuditActor,
): Promise<void> {
  await assertDraft(invoiceId);

  const item = await InvoiceLineItemModel.findOne({ _id: itemId, invoiceId });
  if (!item) throw new AppError("Line item not found", 404);

  const snapshot = item.toObject();
  await item.deleteOne();

  await InvoiceLineItemHistoryModel.create({
    lineItemId: new Types.ObjectId(itemId),
    invoiceId:  new Types.ObjectId(invoiceId),
    action:     "deleted",
    before:     snapshot,
    after:      null,
    changedBy:  { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email },
    changedAt:  new Date(),
  });

  await recalculateInvoiceTotals(invoiceId);
}

/* ─── Queries ──────────────────────────────────────────────────────────────── */

export async function getLineItems(invoiceId: string): Promise<IInvoiceLineItem[]> {
  const items = await InvoiceLineItemModel.find({ invoiceId }).sort({ sortOrder: 1 }).lean().exec();
  return items as unknown as IInvoiceLineItem[];
}

export async function getLineItemHistory(invoiceId: string) {
  return InvoiceLineItemHistoryModel.find({ invoiceId }).sort({ changedAt: -1 }).lean();
}
