import crypto from "crypto";
import { Types } from "mongoose";
import { InvoiceModel, type IInvoice, type IInvoiceTaxLine } from "./invoice.schema";
import { InvoiceLineItemModel } from "./invoice_line_item.schema";
import { InvoiceLineItemHistoryModel } from "./invoice_line_item_history.schema";
import { nextInvoiceNumber } from "./invoice.numbering";
import { recalculateInvoiceTotals } from "./invoice_line_item.service";
import { autoRefundOnCancellation, reverseAllocationsForInvoice, recalculatePaymentStatus } from "./payment.service";
import { OrderModel } from "@/modules/orders/orders.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { config } from "@/config";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";
import { logger } from "@/common/utils/logger";

/* ─── createFromOrder ──────────────────────────────────────────────────────── */
/* Idempotent — safe to call multiple times for the same order */

export async function createFromOrder(orderId: string): Promise<IInvoice | null> {
  const existing = await InvoiceModel.findOne({ orderId }).lean();
  if (existing) return existing as unknown as IInvoice;

  const order = await OrderModel.findById(orderId)
    .populate("userId", "email fullName")
    .lean();
  if (!order) {
    logger.warn("[Invoices] createFromOrder — order not found", { orderId });
    return null;
  }

  let customerName  = "Guest";
  let customerEmail = "";
  let customerId:   Types.ObjectId | undefined;

  if (order.userId && typeof order.userId === "object" && "email" in order.userId) {
    const u = order.userId as unknown as { _id: Types.ObjectId; email: string; fullName: string };
    customerId    = u._id;
    customerName  = u.fullName;
    customerEmail = u.email;
  } else if (order.guestInfo) {
    customerName  = order.guestInfo.fullName;
    customerEmail = order.guestInfo.email;
  }

  const ba = order.billingAddress;
  const taxLines: IInvoiceTaxLine[] = (order.taxBreakdown ?? []).map((t) => ({
    label:  t.name,
    rate:   t.rate,
    amount: t.amount,
  }));
  const taxTotal = taxLines.reduce((s, t) => s + t.amount, 0);

  const now           = new Date();
  const invoiceNumber = await nextInvoiceNumber("ecommerce", now);

  let guestToken:          string | undefined;
  let guestTokenExpiresAt: Date | undefined;
  if (!customerId) {
    guestToken          = crypto.randomBytes(32).toString("hex");
    guestTokenExpiresAt = new Date(Date.now() + config.INVOICE_GUEST_TOKEN_TTL_DAYS * 86_400_000);
  }

  /* Create the invoice header — immediately finalized for ecommerce */
  const invoice = await InvoiceModel.create({
    invoiceNumber,
    type:          "ecommerce",
    status:        "finalized",
    paymentStatus: "unpaid",
    orderId:       order._id,
    orderNumber:   order.orderNumber,
    customerId,
    customerName,
    customerEmail,
    billingAddress: {
      fullName:     ba.fullName,
      phone:        ba.phone,
      addressLine1: ba.address1,
      addressLine2: ba.address2 ?? "",
      city:         ba.city,
      province:     ba.province,
      postalCode:   ba.postalCode,
      country:      ba.country,
    },
    subtotal:       order.subtotal,
    discountAmount: order.discountAmount ?? 0,
    couponCode:     order.couponCode ?? undefined,
    taxLines,
    taxTotal,
    total:          order.total,
    amountPaid:     0,
    amountDue:      order.total,
    guestToken,
    guestTokenExpiresAt,
    issuedAt:       now,
  });

  /* Create line items in separate collection — one per order item */
  const lineItems = order.items.map((item, idx) => ({
    invoiceId:      invoice._id,
    productId:      item.productId,
    name:           item.name,
    sku:            item.sku,
    quantity:       item.quantity,
    unitPrice:      item.price,
    discountAmount: 0,
    lineTotal:      item.lineTotal,
    sortOrder:      idx,
  }));

  if (lineItems.length > 0) {
    await InvoiceLineItemModel.insertMany(lineItems);
  }

  return invoice;
}

/* ─── createAdhocDraft ─────────────────────────────────────────────────────── */

export interface AdhocDraftInput {
  customerName:   string;
  customerEmail:  string;
  customerId?:    string;
  billingAddress: IInvoice["billingAddress"];
  items?: Array<{
    name:           string;
    sku:            string;
    description?:   string;
    productId?:     string;
    quantity:       number;
    unitPrice:      number;
    discountAmount?: number;
  }>;
  taxLines?:       Array<{ label: string; rate: number; amount: number }>;
  discountAmount?: number;
  couponCode?:     string;
  notes?:          string;
  internalNotes?:  string;
}

export async function createAdhocDraft(input: AdhocDraftInput, actor: AuditActor): Promise<IInvoice> {
  const now = new Date();

  const taxLines: IInvoiceTaxLine[] = (input.taxLines ?? []).map((t) => ({
    label: t.label, rate: t.rate, amount: t.amount,
  }));
  const taxTotal       = taxLines.reduce((s, t) => s + t.amount, 0);
  const discountAmount = input.discountAmount ?? 0;

  /* Calculate subtotal from items if provided */
  const lineItemInputs = input.items ?? [];
  let subtotal = 0;
  if (lineItemInputs.length > 0) {
    subtotal = lineItemInputs.reduce((s, i) => {
      const disc = i.discountAmount ?? 0;
      return s + Math.max(0, i.quantity * i.unitPrice - disc);
    }, 0);
  }
  const total    = Math.max(0, subtotal - discountAmount + taxTotal);
  const invoiceNumber = await nextInvoiceNumber("adhoc", now);

  const invoice = await InvoiceModel.create({
    invoiceNumber,
    type:          "adhoc",
    status:        "draft",
    paymentStatus: "unpaid",
    customerId:    input.customerId ? new Types.ObjectId(input.customerId) : undefined,
    customerName:  input.customerName,
    customerEmail: input.customerEmail,
    billingAddress: input.billingAddress,
    subtotal,
    discountAmount,
    couponCode:    input.couponCode,
    taxLines,
    taxTotal,
    total,
    amountPaid:    0,
    amountDue:     total,
    notes:         input.notes,
    internalNotes: input.internalNotes,
    createdBy:     {
      id:    new Types.ObjectId(actor.id),
      name:  actor.name,
      email: actor.email,
    },
  });

  /* Persist line items if provided */
  if (lineItemInputs.length > 0) {
    const docs = lineItemInputs.map((i, idx) => {
      const disc      = i.discountAmount ?? 0;
      const lineTotal = Math.max(0, i.quantity * i.unitPrice - disc);
      return {
        invoiceId:      invoice._id,
        productId:      i.productId ? new Types.ObjectId(i.productId) : undefined,
        name:           i.name,
        sku:            i.sku,
        description:    i.description,
        quantity:       i.quantity,
        unitPrice:      i.unitPrice,
        discountAmount: disc,
        lineTotal,
        sortOrder:      idx,
      };
    });

    const created = await InvoiceLineItemModel.insertMany(docs);

    /* Write created history entries */
    const historyDocs = created.map((item) => ({
      lineItemId: item._id,
      invoiceId:  invoice._id,
      action:     "created" as const,
      before:     null,
      after:      item.toObject(),
      changedBy:  { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email },
      changedAt:  now,
    }));
    await InvoiceLineItemHistoryModel.insertMany(historyDocs);
  }

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     "invoice.adhoc.draft.create",
    resource:   "invoice",
    resourceId: String(invoice._id),
    before:     null,
    after:      { invoiceNumber, total, customerEmail: input.customerEmail },
    ipAddress:  actor.ip,
  });

  return invoice;
}

/* ─── finalizeInvoice ──────────────────────────────────────────────────────── */

export async function finalizeInvoice(id: string, actor: AuditActor): Promise<IInvoice> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new AppError("Invoice not found", 404);
  if (invoice.status !== "draft") throw new AppError("Only draft invoices can be finalized", 409);

  const hasItems = await InvoiceLineItemModel.exists({ invoiceId: id });
  if (!hasItems) throw new AppError("Cannot finalize an invoice with no line items", 409);

  const now          = new Date();
  invoice.status     = "finalized";
  invoice.issuedAt   = now;
  invoice.paymentStatus = "unpaid";
  const saved = await invoice.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     "invoice.finalize",
    resource:   "invoice",
    resourceId: id,
    before:     { status: "draft" },
    after:      { status: "finalized", issuedAt: now },
    ipAddress:  actor.ip,
  });

  return saved;
}

/* ─── cancelInvoice ────────────────────────────────────────────────────────── */

export async function cancelInvoice(id: string, reason: string, actor: AuditActor): Promise<IInvoice> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new AppError("Invoice not found", 404);
  if (invoice.status === "cancelled" || invoice.status === "system_cancelled") {
    throw new AppError("Invoice is already cancelled", 409);
  }

  const prevStatus = invoice.status;

  /* Auto-create refund transactions if the invoice had payments, then reverse allocations */
  if (invoice.amountPaid > 0) {
    await autoRefundOnCancellation(id, actor);
  }
  await reverseAllocationsForInvoice(id);

  const now             = new Date();
  invoice.status        = "cancelled";
  invoice.paymentStatus = "cancelled";
  invoice.cancelledAt   = now;
  invoice.cancelledBy   = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };
  invoice.cancelReason  = reason;
  invoice.amountPaid    = 0;
  invoice.amountDue     = 0;

  const saved = await invoice.save();

  await logAction({
    userId:     actor.id,
    userEmail:  actor.email,
    actorName:  actor.name,
    action:     "invoice.cancel",
    resource:   "invoice",
    resourceId: id,
    before:     { status: prevStatus },
    after:      { status: "cancelled", cancelReason: reason },
    ipAddress:  actor.ip,
  });

  return saved;
}

/* ─── systemCancelInvoice ──────────────────────────────────────────────────── */
/* Called by other modules (e.g. order cancellation) with no actor */

export async function systemCancelInvoice(id: string, reason: string): Promise<void> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) return;
  if (invoice.status === "cancelled" || invoice.status === "system_cancelled") return;

  await reverseAllocationsForInvoice(id);

  invoice.status        = "system_cancelled";
  invoice.paymentStatus = "system_cancelled";
  invoice.cancelledAt   = new Date();
  invoice.cancelReason  = reason;
  invoice.amountPaid    = 0;
  invoice.amountDue     = 0;

  await invoice.save();
}

/* ─── updateDraftHeader ────────────────────────────────────────────────────── */
/* Allows editing discount / tax lines / notes on a draft invoice */

export interface DraftHeaderUpdate {
  discountAmount?: number;
  couponCode?:     string;
  taxLines?:       Array<{ label: string; rate: number; amount: number }>;
  notes?:          string;
  internalNotes?:  string;
}

export async function updateDraftHeader(id: string, input: DraftHeaderUpdate, actor: AuditActor): Promise<IInvoice> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new AppError("Invoice not found", 404);
  if (invoice.status !== "draft") throw new AppError("Only draft invoices can be edited", 409);

  if (input.discountAmount !== undefined) invoice.discountAmount = input.discountAmount;
  if (input.couponCode     !== undefined) invoice.couponCode     = input.couponCode;
  if (input.taxLines       !== undefined) {
    invoice.taxLines = input.taxLines;
    invoice.taxTotal = input.taxLines.reduce((s, t) => s + t.amount, 0);
  }
  if (input.notes         !== undefined) invoice.notes         = input.notes;
  if (input.internalNotes !== undefined) invoice.internalNotes = input.internalNotes;

  await invoice.save();
  /* Recalculate totals since discount/tax changed */
  await recalculateInvoiceTotals(id);

  const updated = await InvoiceModel.findById(id).lean().exec();
  return updated as unknown as IInvoice;
}

/* ─── Admin queries ────────────────────────────────────────────────────────── */

export async function listAdminInvoices(filters: {
  type?: string; status?: string; paymentStatus?: string; search?: string;
  page?: number; limit?: number; dateFrom?: Date; dateTo?: Date;
} = {}) {
  const { type, status, paymentStatus, search, page = 1, limit = 25, dateFrom, dateTo } = filters;
  const query: Record<string, unknown> = {};
  if (type)          query.type          = type;
  if (status)        query.status        = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (dateFrom || dateTo) {
    query.issuedAt = {};
    if (dateFrom) (query.issuedAt as Record<string, Date>).$gte = dateFrom;
    if (dateTo)   (query.issuedAt as Record<string, Date>).$lte = dateTo;
  }
  if (search) {
    query.$or = [
      { invoiceNumber:  { $regex: search, $options: "i" } },
      { customerEmail:  { $regex: search, $options: "i" } },
      { customerName:   { $regex: search, $options: "i" } },
      { orderNumber:    { $regex: search, $options: "i" } },
    ];
  }
  const [total, data] = await Promise.all([
    InvoiceModel.countDocuments(query),
    InvoiceModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getAdminInvoice(id: string) {
  const invoice = await InvoiceModel.findById(id).lean();
  if (!invoice) throw new AppError("Invoice not found", 404);
  const lineItems = await InvoiceLineItemModel.find({ invoiceId: id }).sort({ sortOrder: 1 }).lean();
  return { ...invoice, lineItems };
}

/* ─── Patient queries ──────────────────────────────────────────────────────── */

export async function listMyInvoices(userId: string, page = 1, limit = 20) {
  const query = { customerId: new Types.ObjectId(userId), status: "finalized" };
  const [total, data] = await Promise.all([
    InvoiceModel.countDocuments(query),
    InvoiceModel.find(query).sort({ issuedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function getMyInvoice(id: string, userId: string) {
  const invoice = await InvoiceModel.findOne({
    _id: id,
    customerId: new Types.ObjectId(userId),
    status: "finalized",
  }).lean();
  if (!invoice) throw new AppError("Invoice not found", 404);
  const lineItems = await InvoiceLineItemModel.find({ invoiceId: id }).sort({ sortOrder: 1 }).lean();
  return { ...invoice, lineItems };
}

export async function getByGuestToken(token: string) {
  const invoice = await InvoiceModel.findOne({
    guestToken:           token,
    status:               "finalized",
    guestTokenExpiresAt:  { $gt: new Date() },
  }).lean();
  if (!invoice) throw new AppError("Invoice not found or link has expired", 404);
  const lineItems = await InvoiceLineItemModel.find({ invoiceId: String(invoice._id) }).sort({ sortOrder: 1 }).lean();
  return { ...invoice, lineItems };
}

/* ─── Summary report ───────────────────────────────────────────────────────── */

export async function invoiceSummary(dateFrom?: Date, dateTo?: Date) {
  const { PaymentTransactionModel } = await import("./payment_transaction.schema");

  const dateFilter: Record<string, Date> = {};
  if (dateFrom) dateFilter.$gte = dateFrom;
  if (dateTo)   dateFilter.$lte = dateTo;

  const invoiceMatch: Record<string, unknown> = { status: "finalized" };
  if (dateFrom || dateTo) invoiceMatch.issuedAt = dateFilter;

  const refundMatch: Record<string, unknown> = { type: "refund" };
  if (dateFrom || dateTo) refundMatch.createdAt = dateFilter;

  const [invoiceResult, refundResult, pendingRefundCount] = await Promise.all([
    InvoiceModel.aggregate([
      { $match: invoiceMatch },
      { $group: {
        _id:           null,
        totalRevenue:  { $sum: "$total" },
        totalTax:      { $sum: "$taxTotal" },
        totalDiscount: { $sum: "$discountAmount" },
        totalPaid:     { $sum: "$amountPaid" },
        totalDue:      { $sum: "$amountDue" },
        count:         { $sum: 1 },
        ecommerceCount:  { $sum: { $cond: [{ $eq: ["$type", "ecommerce"] }, 1, 0] } },
        adhocCount:      { $sum: { $cond: [{ $eq: ["$type", "adhoc"] },     1, 0] } },
        unpaidCount:     { $sum: { $cond: [{ $eq: ["$paymentStatus", "unpaid"] },       1, 0] } },
        partialCount:    { $sum: { $cond: [{ $eq: ["$paymentStatus", "partial_paid"] }, 1, 0] } },
        paidCount:       { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] },         1, 0] } },
      }},
    ]),
    /* Refund breakdown — grouped by status */
    PaymentTransactionModel.aggregate([
      { $match: refundMatch },
      { $group: {
        _id:              null,
        totalRefunded:    { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] } },
        pendingAmount:    { $sum: { $cond: [{ $eq: ["$status", "pending"] },   "$amount", 0] } },
        refundCount:      { $sum: 1 },
        completedCount:   { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        pendingCount:     { $sum: { $cond: [{ $eq: ["$status", "pending"] },   1, 0] } },
        failedCount:      { $sum: { $cond: [{ $eq: ["$status", "failed"] },    1, 0] } },
        cancelledCount:   { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        cashCount:        { $sum: { $cond: [{ $eq: ["$method", "cash"] },         1, 0] } },
        cardCount:        { $sum: { $cond: [{ $eq: ["$method", "card"] },         1, 0] } },
        eTransferCount:   { $sum: { $cond: [{ $eq: ["$method", "e_transfer"] },   1, 0] } },
        chequeCount:      { $sum: { $cond: [{ $eq: ["$method", "cheque"] },       1, 0] } },
      }},
    ]),
    PaymentTransactionModel.countDocuments({ type: "refund", status: "pending" }),
  ]);

  const inv = invoiceResult[0] ?? {
    totalRevenue: 0, totalTax: 0, totalDiscount: 0, totalPaid: 0, totalDue: 0,
    count: 0, ecommerceCount: 0, adhocCount: 0, unpaidCount: 0, partialCount: 0, paidCount: 0,
  };

  const ref = refundResult[0] ?? {
    totalRefunded: 0, pendingAmount: 0, refundCount: 0,
    completedCount: 0, pendingCount: 0, failedCount: 0, cancelledCount: 0,
    cashCount: 0, cardCount: 0, eTransferCount: 0, chequeCount: 0,
  };

  return {
    /* Invoice summary */
    ...inv,
    /* Refund report — embedded in same response */
    refunds: {
      totalRefunded:  ref.totalRefunded,
      pendingAmount:  ref.pendingAmount,
      pendingCount:   pendingRefundCount,
      completedCount: ref.completedCount,
      failedCount:    ref.failedCount,
      cancelledCount: ref.cancelledCount,
      byMethod: {
        cash:      ref.cashCount,
        card:      ref.cardCount,
        eTransfer: ref.eTransferCount,
        cheque:    ref.chequeCount,
      },
    },
  };
}
