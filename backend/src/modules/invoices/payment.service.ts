import { Types } from "mongoose";
import { InvoiceModel } from "./invoice.schema";
import { PaymentTransactionModel, type IPaymentTransaction, type PaymentMethod } from "./payment_transaction.schema";
import { PaymentAllocationModel, type IPaymentAllocation } from "./payment_allocation.schema";
import { AppError } from "@/common/middleware/error.middleware";
import { logAction, type AuditActor } from "@/modules/audit/audit.service";

/* ─── recalculatePaymentStatus ─────────────────────────────────────────────── */

export async function recalculatePaymentStatus(invoiceId: string): Promise<void> {
  const invoice = await InvoiceModel.findById(invoiceId);
  if (!invoice) return;

  if (invoice.status === "cancelled" || invoice.status === "system_cancelled") {
    invoice.paymentStatus = invoice.status === "cancelled" ? "cancelled" : "system_cancelled";
    invoice.amountDue     = 0;
    await invoice.save();
    return;
  }

  const paid  = invoice.amountPaid;
  const total = invoice.total;
  invoice.amountDue = Math.max(0, total - paid);

  if      (paid === 0)       invoice.paymentStatus = "unpaid";
  else if (paid < total)     invoice.paymentStatus = "partial_paid";
  else if (paid === total)   invoice.paymentStatus = "paid";
  else                       invoice.paymentStatus = "overpaid";

  await invoice.save();
}

/* ─── createTransaction ────────────────────────────────────────────────────── */

export interface CreateTransactionInput {
  amount:      number;
  method:      PaymentMethod;
  reference?:  string;
  payerId?:    string;
  payerName?:  string;
  payerEmail?: string;
  notes?:      string;
}

export async function createTransaction(
  input: CreateTransactionInput,
  actor: AuditActor,
): Promise<IPaymentTransaction> {
  if (input.amount <= 0) throw new AppError("Transaction amount must be positive", 400);

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };

  const tx = await PaymentTransactionModel.create({
    type:              "payment",
    amount:            input.amount,
    currency:          "CAD",
    method:            input.method,
    reference:         input.reference,
    status:            "completed",
    payerId:           input.payerId ? new Types.ObjectId(input.payerId) : undefined,
    payerName:         input.payerName,
    payerEmail:        input.payerEmail,
    amountAllocated:   0,
    amountUnallocated: input.amount,
    recordedBy:        actorStamp,
    financiallySettled: false,
    statusHistory: [{ status: "completed", changedBy: actorStamp, changedAt: new Date() }],
    notes:             input.notes,
  });

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.transaction.create", resource: "payment_transaction",
    resourceId: String(tx._id),
    before: null, after: { amount: input.amount, method: input.method },
    ipAddress: actor.ip,
  });

  return tx;
}

/* ─── allocatePayment ──────────────────────────────────────────────────────── */

export interface AllocateInput {
  transactionId: string;
  invoiceId:     string;
  amount:        number;
  notes?:        string;
}

export async function allocatePayment(
  input: AllocateInput,
  actor: AuditActor,
): Promise<IPaymentAllocation> {
  if (input.amount <= 0) throw new AppError("Allocation amount must be positive", 400);

  const [tx, invoice] = await Promise.all([
    PaymentTransactionModel.findById(input.transactionId),
    InvoiceModel.findById(input.invoiceId),
  ]);

  if (!tx)      throw new AppError("Payment transaction not found", 404);
  if (!invoice) throw new AppError("Invoice not found", 404);

  if (tx.type !== "payment")
    throw new AppError("Only payment transactions can be allocated", 409);
  if (tx.status === "failed" || tx.status === "refunded")
    throw new AppError(`Cannot allocate from a ${tx.status} transaction`, 409);
  if (invoice.status !== "finalized")
    throw new AppError("Payments can only be applied to finalized invoices", 409);
  if (input.amount > tx.amountUnallocated)
    throw new AppError(`Amount exceeds unallocated balance (${tx.amountUnallocated} cents available)`, 400);

  const allocation = await PaymentAllocationModel.create({
    transactionId: new Types.ObjectId(input.transactionId),
    invoiceId:     new Types.ObjectId(input.invoiceId),
    amount:        input.amount,
    allocatedBy:   { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email },
    notes:         input.notes,
  });

  await PaymentTransactionModel.updateOne(
    { _id: input.transactionId },
    { $inc: { amountAllocated: input.amount, amountUnallocated: -input.amount } },
  );
  await InvoiceModel.updateOne(
    { _id: input.invoiceId },
    { $inc: { amountPaid: input.amount } },
  );
  await recalculatePaymentStatus(input.invoiceId);

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.allocation.create", resource: "payment_allocation",
    resourceId: String(allocation._id),
    before: null,
    after: { transactionId: input.transactionId, invoiceId: input.invoiceId, amount: input.amount },
    ipAddress: actor.ip,
  });

  return allocation;
}

/* ─── createRefund ─────────────────────────────────────────────────────────── */
/* Creates a PENDING refund — no financial changes yet.
   Financial changes happen only when processRefund() is called.             */

export interface CreateRefundInput {
  transactionId: string;
  invoiceId:     string;
  amount:        number;
  reason:        string;
  method:        PaymentMethod;
  notes?:        string;
}

export async function createRefund(
  input: CreateRefundInput,
  actor: AuditActor,
): Promise<IPaymentTransaction> {
  if (input.amount <= 0)      throw new AppError("Refund amount must be positive", 400);
  if (!input.reason?.trim())  throw new AppError("Refund reason is required", 400);

  const [originalTx, invoice] = await Promise.all([
    PaymentTransactionModel.findById(input.transactionId),
    InvoiceModel.findById(input.invoiceId),
  ]);

  if (!originalTx) throw new AppError("Original payment transaction not found", 404);
  if (!invoice)    throw new AppError("Invoice not found", 404);

  if (originalTx.type !== "payment")
    throw new AppError("Can only refund against a payment transaction", 409);
  if (invoice.status !== "finalized")
    throw new AppError("Refunds can only be initiated on finalized invoices", 409);
  if (input.amount > originalTx.amountAllocated)
    throw new AppError(`Refund amount exceeds allocated amount (${originalTx.amountAllocated} cents)`, 400);
  if (input.amount > invoice.amountPaid)
    throw new AppError(`Refund amount exceeds amount paid on invoice (${invoice.amountPaid} cents)`, 400);

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };

  const refundTx = await PaymentTransactionModel.create({
    type:               "refund",
    amount:             input.amount,
    currency:           "CAD",
    method:             input.method,
    status:             "pending", /* financial changes applied only on processRefund() */
    refundOf:           new Types.ObjectId(input.transactionId),
    refundReason:       input.reason.trim(),
    amountAllocated:    0,
    amountUnallocated:  0,
    recordedBy:         actorStamp,
    financiallySettled: false,
    statusHistory:      [{ status: "pending", changedBy: actorStamp, changedAt: new Date() }],
    notes:              input.notes,
  });

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.refund.initiate", resource: "payment_transaction",
    resourceId: String(refundTx._id),
    before: null,
    after: { refundOf: input.transactionId, invoiceId: input.invoiceId, amount: input.amount, reason: input.reason },
    ipAddress: actor.ip,
  });

  return refundTx;
}

/* ─── processRefund ────────────────────────────────────────────────────────── */
/* Marks a pending refund as completed and applies financial changes.
   For cancellation auto-refunds (financiallySettled=true) — only status update. */

export async function processRefund(
  refundTxId: string,
  actor:      AuditActor,
  note?:      string,
): Promise<IPaymentTransaction> {
  const refundTx = await PaymentTransactionModel.findById(refundTxId);
  if (!refundTx)               throw new AppError("Refund transaction not found", 404);
  if (refundTx.type !== "refund") throw new AppError("Transaction is not a refund", 409);
  if (refundTx.status !== "pending")
    throw new AppError(`Cannot process a refund with status "${refundTx.status}"`, 409);

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };
  const now        = new Date();

  if (!refundTx.financiallySettled && refundTx.refundOf) {
    /* Validate amounts are still valid (re-check against live data) */
    const [originalTx, allocation] = await Promise.all([
      PaymentTransactionModel.findById(refundTx.refundOf),
      PaymentAllocationModel.findOne({ transactionId: refundTx.refundOf }),
    ]);

    if (!originalTx) throw new AppError("Original transaction no longer exists", 409);
    if (refundTx.amount > originalTx.amountAllocated)
      throw new AppError("Refund amount exceeds current allocated balance — original transaction may have changed", 409);

    /* Reduce / remove allocation */
    if (allocation) {
      const remaining = allocation.amount - refundTx.amount;
      if (remaining <= 0) {
        await allocation.deleteOne();
      } else {
        allocation.amount = remaining;
        await allocation.save();
      }
    }

    /* Restore unallocated balance on original transaction */
    await PaymentTransactionModel.updateOne(
      { _id: refundTx.refundOf },
      { $inc: { amountAllocated: -refundTx.amount, amountUnallocated: refundTx.amount } },
    );

    /* Mark original as "refunded" if fully reversed */
    const refreshedOriginal = await PaymentTransactionModel.findById(refundTx.refundOf);
    if (refreshedOriginal && refreshedOriginal.amountAllocated === 0) {
      await PaymentTransactionModel.updateOne(
        { _id: refundTx.refundOf },
        { $set: { status: "refunded" } },
      );
    }

    /* Decrement invoice amountPaid — only if invoice is still finalized */
    const invoice = await InvoiceModel.findOne({ _id: allocation?.invoiceId });
    if (invoice && invoice.status === "finalized") {
      await InvoiceModel.updateOne(
        { _id: invoice._id },
        { $inc: { amountPaid: -refundTx.amount } },
      );
      await recalculatePaymentStatus(String(invoice._id));
    }
  }

  /* Update refund transaction to completed */
  refundTx.status      = "completed";
  refundTx.processedBy = actorStamp;
  refundTx.processedAt = now;
  refundTx.statusHistory.push({ status: "completed", changedBy: actorStamp, changedAt: now, note });
  await refundTx.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.refund.process", resource: "payment_transaction",
    resourceId: refundTxId,
    before: { status: "pending" }, after: { status: "completed", processedBy: actor.email },
    ipAddress: actor.ip,
  });

  return refundTx;
}

/* ─── failRefund ───────────────────────────────────────────────────────────── */

export async function failRefund(
  refundTxId: string,
  reason:     string,
  actor:      AuditActor,
): Promise<IPaymentTransaction> {
  const refundTx = await PaymentTransactionModel.findById(refundTxId);
  if (!refundTx)                  throw new AppError("Refund transaction not found", 404);
  if (refundTx.type !== "refund") throw new AppError("Transaction is not a refund", 409);
  if (refundTx.status !== "pending")
    throw new AppError(`Cannot fail a refund with status "${refundTx.status}"`, 409);

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };
  const now        = new Date();

  refundTx.status        = "failed";
  refundTx.failureReason = reason;
  refundTx.statusHistory.push({ status: "failed", changedBy: actorStamp, changedAt: now, note: reason });
  await refundTx.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.refund.fail", resource: "payment_transaction",
    resourceId: refundTxId,
    before: { status: "pending" }, after: { status: "failed", failureReason: reason },
    ipAddress: actor.ip,
  });

  return refundTx;
}

/* ─── cancelRefund ─────────────────────────────────────────────────────────── */

export async function cancelRefund(
  refundTxId: string,
  reason:     string,
  actor:      AuditActor,
): Promise<IPaymentTransaction> {
  const refundTx = await PaymentTransactionModel.findById(refundTxId);
  if (!refundTx)                  throw new AppError("Refund transaction not found", 404);
  if (refundTx.type !== "refund") throw new AppError("Transaction is not a refund", 409);
  if (refundTx.status !== "pending")
    throw new AppError(`Cannot cancel a refund with status "${refundTx.status}"`, 409);

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };
  const now        = new Date();

  refundTx.status = "cancelled";
  refundTx.statusHistory.push({ status: "cancelled", changedBy: actorStamp, changedAt: now, note: reason });
  await refundTx.save();

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.refund.cancel", resource: "payment_transaction",
    resourceId: refundTxId,
    before: { status: "pending" }, after: { status: "cancelled" },
    ipAddress: actor.ip,
  });

  return refundTx;
}

/* ─── autoRefundOnCancellation ─────────────────────────────────────────────── */
/* Creates pending refund records when a paid invoice is cancelled.
   financiallySettled=true because reverseAllocationsForInvoice() already
   handles the financial cleanup — processRefund() will only update status.  */

export async function autoRefundOnCancellation(invoiceId: string, actor: AuditActor): Promise<void> {
  const invoice = await InvoiceModel.findById(invoiceId).lean();
  if (!invoice || invoice.amountPaid === 0) return;

  const allocations = await PaymentAllocationModel.find({ invoiceId }).lean();
  if (allocations.length === 0) return;

  const actorStamp = { id: new Types.ObjectId(actor.id), name: actor.name, email: actor.email };
  const now        = new Date();

  const refundDocs = await Promise.all(
    allocations.map(async (alloc) => {
      const originalTx = await PaymentTransactionModel.findById(alloc.transactionId).lean();
      return {
        type:               "refund" as const,
        amount:             alloc.amount,
        currency:           "CAD",
        method:             originalTx?.method ?? "cash",
        status:             "pending" as const,
        refundOf:           alloc.transactionId,
        refundReason:       "Invoice cancelled",
        amountAllocated:    0,
        amountUnallocated:  0,
        recordedBy:         actorStamp,
        financiallySettled: true, /* financial cleanup done by reverseAllocationsForInvoice */
        statusHistory:      [{ status: "pending" as const, changedBy: actorStamp, changedAt: now,
          note: "Auto-created on invoice cancellation" }],
      };
    }),
  );

  await PaymentTransactionModel.insertMany(refundDocs);

  await logAction({
    userId: actor.id, userEmail: actor.email, actorName: actor.name,
    action: "payment.refund.auto_on_cancellation", resource: "invoice",
    resourceId: invoiceId,
    before: null,
    after: { invoiceId, totalRefunded: invoice.amountPaid, allocationCount: allocations.length },
    ipAddress: actor.ip,
  });
}

/* ─── reverseAllocationsForInvoice ────────────────────────────────────────── */

export async function reverseAllocationsForInvoice(invoiceId: string): Promise<void> {
  const allocations = await PaymentAllocationModel.find({ invoiceId }).lean();
  if (allocations.length === 0) return;

  const txMap = new Map<string, number>();
  for (const alloc of allocations) {
    const txId = String(alloc.transactionId);
    txMap.set(txId, (txMap.get(txId) ?? 0) + alloc.amount);
  }

  const updates = Array.from(txMap.entries()).map(([txId, reversed]) =>
    PaymentTransactionModel.updateOne(
      { _id: txId },
      { $inc: { amountAllocated: -reversed, amountUnallocated: reversed } },
    ),
  );

  await Promise.all([...updates, PaymentAllocationModel.deleteMany({ invoiceId })]);
}

/* ─── Queries ──────────────────────────────────────────────────────────────── */

export async function listTransactions(filters: {
  type?: string; status?: string; method?: string; search?: string;
  page?: number; limit?: number;
} = {}) {
  const { type, status, method, search, page = 1, limit = 25 } = filters;
  const query: Record<string, unknown> = {};
  if (type)   query.type   = type;
  if (status) query.status = status;
  if (method) query.method = method;
  if (search) {
    query.$or = [
      { reference:  { $regex: search, $options: "i" } },
      { payerName:  { $regex: search, $options: "i" } },
      { payerEmail: { $regex: search, $options: "i" } },
    ];
  }
  const [total, data] = await Promise.all([
    PaymentTransactionModel.countDocuments(query),
    PaymentTransactionModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  return { data, total, page, limit };
}

export async function listPendingRefunds(filters: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 25 } = filters;
  const query = { type: "refund", status: "pending" };
  const [total, data] = await Promise.all([
    PaymentTransactionModel.countDocuments(query),
    PaymentTransactionModel.find(query)
      .sort({ createdAt: 1 }) /* oldest first — process FIFO */
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("refundOf", "amount method reference recordedBy createdAt")
      .lean(),
  ]);
  return { data, total, page, limit };
}

export async function getTransaction(id: string) {
  const tx = await PaymentTransactionModel.findById(id)
    .populate("refundOf", "amount method reference status recordedBy createdAt")
    .lean();
  if (!tx) throw new AppError("Payment transaction not found", 404);

  const [allocations, refunds] = await Promise.all([
    PaymentAllocationModel.find({ transactionId: id })
      .populate("invoiceId", "invoiceNumber customerName total status paymentStatus")
      .sort({ createdAt: -1 })
      .lean(),
    PaymentTransactionModel.find({ refundOf: id })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return { ...tx, allocations, refunds };
}

export async function getAllocationsForInvoice(invoiceId: string) {
  return PaymentAllocationModel.find({ invoiceId })
    .populate("transactionId", "type amount currency method reference status recordedBy createdAt")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getRefundsForInvoice(invoiceId: string) {
  const allocations = await PaymentAllocationModel.find({ invoiceId }).lean();
  const txIds = allocations.map((a) => a.transactionId);

  /* Also get auto-refunds from cancelled invoices (no allocations left) */
  const invoice = await InvoiceModel.findById(invoiceId).select("status").lean();
  const isCancelled = invoice?.status === "cancelled" || invoice?.status === "system_cancelled";

  let query: Record<string, unknown>;
  if (isCancelled) {
    /* For cancelled invoices, find refunds linked to transactions that were allocated to this invoice */
    const allTxIds = await PaymentAllocationModel.find({ invoiceId })
      .lean()
      .then((a) => a.map((x) => x.transactionId));
    /* Also check payment transactions that were used before cancellation */
    query = { type: "refund", $or: [
      { refundOf: { $in: txIds.concat(allTxIds) } },
    ]};
  } else {
    query = { type: "refund", refundOf: { $in: txIds } };
  }

  return PaymentTransactionModel.find(query)
    .sort({ createdAt: -1 })
    .lean();
}
