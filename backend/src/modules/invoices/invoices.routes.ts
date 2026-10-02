import { Router } from "express";
import { z }       from "zod";
import { authenticate, requirePermission } from "@/common/middleware/auth.middleware";
import { asyncHandler }  from "@/common/utils/asyncHandler";
import { sendSuccess, sendList, sendError } from "@/common/utils/response";
import { AppError }      from "@/common/middleware/error.middleware";
import { renderInvoiceHtml, type RenderableInvoice } from "./invoice.template";
import { htmlToPdf }         from "@/lib/playwrightPdf.service";

import {
  createAdhocDraft, finalizeInvoice, cancelInvoice,
  updateDraftHeader,
  listAdminInvoices, getAdminInvoice, invoiceSummary,
  listMyInvoices, getMyInvoice, getByGuestToken,
} from "./invoice.service";

import {
  addLineItem, updateLineItem, deleteLineItem,
  getLineItems, getLineItemHistory,
} from "./invoice_line_item.service";

import {
  createTransaction, allocatePayment,
  createRefund, processRefund, failRefund, cancelRefund,
  listTransactions, listPendingRefunds, getTransaction,
  getAllocationsForInvoice, getRefundsForInvoice,
} from "./payment.service";

const router = Router();

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PATIENT ROUTES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

router.get("/my", authenticate, asyncHandler(async (req, res) => {
  const page  = Number(req.query.page  ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const result = await listMyInvoices(req.user!._id, page, limit);
  return sendList(res, result.data, { total: result.total, page: result.page, limit });
}));

router.get("/my/:id", authenticate, asyncHandler(async (req, res) => {
  const invoice = await getMyInvoice(req.params["id"] as string, req.user!._id);
  return sendSuccess(res, invoice);
}));

router.get("/my/:id/pdf", authenticate, asyncHandler(async (req, res) => {
  const invoice = await getMyInvoice(req.params["id"] as string, req.user!._id);
  const html    = renderInvoiceHtml(invoice as unknown as RenderableInvoice);
  const pdf     = await htmlToPdf(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${(invoice as never as { invoiceNumber: string }).invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  return res.end(pdf);
}));

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GUEST ROUTE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

router.get("/guest/pdf", asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (typeof token !== "string" || !token) throw new AppError("Missing token", 400);
  const invoice = await getByGuestToken(token);
  const html    = renderInvoiceHtml(invoice as unknown as RenderableInvoice);
  const pdf     = await htmlToPdf(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${(invoice as never as { invoiceNumber: string }).invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  return res.end(pdf);
}));

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN â€” Payment Transactions  (fixed paths first)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const createTxSchema = z.object({
  amount:     z.number().int().positive(),
  method:     z.enum(["cash", "card", "e_transfer", "cheque"]),
  reference:  z.string().optional(),
  payerId:    z.string().optional(),
  payerName:  z.string().optional(),
  payerEmail: z.string().email().optional(),
  notes:      z.string().optional(),
});

router.get("/admin/payments", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const { status, method, search, page, limit } = req.query as Record<string, string>;
  const result = await listTransactions({
    status:  status  || undefined,
    method:  method  || undefined,
    search:  search  || undefined,
    page:    page    ? Number(page)  : 1,
    limit:   limit   ? Number(limit) : 25,
  });
  return sendList(res, result.data, { total: result.total, page: result.page, limit: result.limit });
}));

router.post("/admin/payments", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const body = createTxSchema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const tx = await createTransaction(body.data, {
    id:    req.user!._id,
    email: req.user!.email,
    name:  req.user!.fullName,
    ip:    req.ip,
  });
  return sendSuccess(res, tx, "Created", 201);
}));

router.get("/admin/payments/:txId", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const tx = await getTransaction(req.params["txId"] as string);
  return sendSuccess(res, tx);
}));

/* Pending refunds dashboard â€” oldest first so staff processes FIFO */
router.get("/admin/payments/pending-refunds", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const { page, limit } = req.query as Record<string, string>;
  const result = await listPendingRefunds({
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 25,
  });
  return sendList(res, result.data, { total: result.total, page: result.page, limit: result.limit });
}));

router.post("/admin/payments/:txId/refund", authenticate, requirePermission("invoices.void"), asyncHandler(async (req, res) => {
  const schema = z.object({
    invoiceId: z.string().min(1),
    amount:    z.number().int().positive(),
    reason:    z.string().min(1),
    method:    z.enum(["cash", "card", "e_transfer", "cheque"]),
    notes:     z.string().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const refundTx = await createRefund(
    { transactionId: req.params["txId"] as string, ...body.data },
    { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip },
  );
  return sendSuccess(res, refundTx, "Refund created", 201);
}));

/* Process a pending refund (money physically returned) */
router.patch("/admin/payments/:txId/process-refund", authenticate, requirePermission("invoices.void"), asyncHandler(async (req, res) => {
  const { note } = req.body as { note?: string };
  const tx = await processRefund(req.params["txId"] as string, {
    id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip,
  }, note);
  return sendSuccess(res, tx);
}));

/* Mark a pending refund as failed */
router.patch("/admin/payments/:txId/fail-refund", authenticate, requirePermission("invoices.void"), asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) return sendError(res, "Failure reason is required", 400);
  const tx = await failRefund(req.params["txId"] as string, reason.trim(), {
    id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip,
  });
  return sendSuccess(res, tx);
}));

/* Cancel a pending refund */
router.patch("/admin/payments/:txId/cancel-refund", authenticate, requirePermission("invoices.void"), asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) return sendError(res, "Cancel reason is required", 400);
  const tx = await cancelRefund(req.params["txId"] as string, reason.trim(), {
    id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip,
  });
  return sendSuccess(res, tx);
}));

router.post("/admin/payments/:txId/allocate", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const schema = z.object({
    invoiceId: z.string().min(1),
    amount:    z.number().int().positive(),
    notes:     z.string().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const alloc = await allocatePayment(
    { transactionId: req.params["txId"] as string, ...body.data },
    { id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip },
  );
  return sendSuccess(res, alloc, "Allocated", 201);
}));

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN â€” Invoice List / Reports  (fixed paths before :id)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

router.get("/admin", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const { type, status, paymentStatus, search, page, limit, dateFrom, dateTo } = req.query as Record<string, string>;
  const result = await listAdminInvoices({
    type:          type          || undefined,
    status:        status        || undefined,
    paymentStatus: paymentStatus || undefined,
    search:        search        || undefined,
    page:          page    ? Number(page)  : 1,
    limit:         limit   ? Number(limit) : 25,
    dateFrom:      dateFrom ? new Date(dateFrom) : undefined,
    dateTo:        dateTo   ? new Date(dateTo)   : undefined,
  });
  return sendList(res, result.data, { total: result.total, page: result.page, limit: result.limit });
}));

router.get("/admin/reports/summary", authenticate, requirePermission("invoices.reports"), asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const summary = await invoiceSummary(
    dateFrom ? new Date(dateFrom) : undefined,
    dateTo   ? new Date(dateTo)   : undefined,
  );
  return sendSuccess(res, summary);
}));

const adhocSchema = z.object({
  customerName:   z.string().min(1),
  customerEmail:  z.string().email(),
  customerId:     z.string().optional(),
  billingAddress: z.object({
    fullName:     z.string().min(1),
    phone:        z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    city:         z.string().min(1),
    province:     z.string().min(1),
    postalCode:   z.string().min(1),
    country:      z.string().min(1),
  }),
  items: z.array(z.object({
    name:           z.string().min(1),
    sku:            z.string().min(1),
    description:    z.string().optional(),
    productId:      z.string().optional(),
    quantity:       z.number().int().positive(),
    unitPrice:      z.number().int().nonnegative(),
    discountAmount: z.number().int().nonnegative().optional(),
  })).optional(),
  taxLines: z.array(z.object({
    label:  z.string().min(1),
    rate:   z.number().nonnegative(),
    amount: z.number().int().nonnegative(),
  })).optional(),
  discountAmount: z.number().int().nonnegative().optional(),
  couponCode:     z.string().optional(),
  notes:          z.string().optional(),
  internalNotes:  z.string().optional(),
});

router.post("/admin/adhoc", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const body = adhocSchema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const invoice = await createAdhocDraft(body.data, {
    id:    req.user!._id,
    email: req.user!.email,
    name:  req.user!.fullName,
    ip:    req.ip,
  });
  return sendSuccess(res, invoice, "Created", 201);
}));

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN â€” Single Invoice  (:id routes)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

router.get("/admin/:id", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const invoice = await getAdminInvoice(req.params["id"] as string);
  return sendSuccess(res, invoice);
}));

router.get("/admin/:id/pdf", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const invoice = await getAdminInvoice(req.params["id"] as string);
  const html    = renderInvoiceHtml(invoice as unknown as RenderableInvoice);
  const pdf     = await htmlToPdf(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${(invoice as { invoiceNumber: string }).invoiceNumber}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  return res.end(pdf);
}));

router.patch("/admin/:id/finalize", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const invoice = await finalizeInvoice(req.params["id"] as string, {
    id:    req.user!._id,
    email: req.user!.email,
    name:  req.user!.fullName,
    ip:    req.ip,
  });
  return sendSuccess(res, invoice);
}));

router.patch("/admin/:id/cancel", authenticate, requirePermission("invoices.void"), asyncHandler(async (req, res) => {
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) return sendError(res, "Cancel reason is required", 400);
  const invoice = await cancelInvoice(req.params["id"] as string, reason.trim(), {
    id:    req.user!._id,
    email: req.user!.email,
    name:  req.user!.fullName,
    ip:    req.ip,
  });
  return sendSuccess(res, invoice);
}));

router.patch("/admin/:id/header", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const schema = z.object({
    discountAmount: z.number().int().nonnegative().optional(),
    couponCode:     z.string().optional(),
    taxLines: z.array(z.object({
      label: z.string().min(1), rate: z.number().nonnegative(), amount: z.number().int().nonnegative(),
    })).optional(),
    notes:         z.string().optional(),
    internalNotes: z.string().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const invoice = await updateDraftHeader(req.params["id"] as string, body.data, {
    id: req.user!._id, email: req.user!.email, name: req.user!.fullName, ip: req.ip,
  });
  return sendSuccess(res, invoice);
}));

/* â”€â”€â”€ Line items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const lineItemSchema = z.object({
  name:           z.string().min(1),
  sku:            z.string().min(1),
  description:    z.string().optional(),
  productId:      z.string().optional(),
  quantity:       z.number().int().positive(),
  unitPrice:      z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().optional(),
});

router.get("/admin/:id/line-items", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const items = await getLineItems(req.params["id"] as string);
  return sendSuccess(res, items);
}));

router.get("/admin/:id/line-items/history", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const history = await getLineItemHistory(req.params["id"] as string);
  return sendSuccess(res, history);
}));

router.post("/admin/:id/line-items", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const body = lineItemSchema.safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const item = await addLineItem(req.params["id"] as string, body.data, {
    id: req.user!._id, email: req.user!.email, name: req.user!.fullName,
  });
  return sendSuccess(res, item, "Added", 201);
}));

router.patch("/admin/:id/line-items/:itemId", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const body = lineItemSchema.partial().safeParse(req.body);
  if (!body.success) return sendError(res, "Validation failed", 400, body.error.flatten().fieldErrors as Record<string, string[]>);
  const item = await updateLineItem(
    req.params["id"] as string,
    req.params["itemId"] as string,
    body.data,
    { id: req.user!._id, email: req.user!.email, name: req.user!.fullName },
  );
  return sendSuccess(res, item);
}));

router.delete("/admin/:id/line-items/:itemId", authenticate, requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  await deleteLineItem(
    req.params["id"] as string,
    req.params["itemId"] as string,
    { id: req.user!._id, email: req.user!.email, name: req.user!.fullName },
  );
  return sendSuccess(res, null, "Deleted");
}));

/* â”€â”€â”€ Invoice payment allocations & refunds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

router.get("/admin/:id/payments", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const allocations = await getAllocationsForInvoice(req.params["id"] as string);
  return sendSuccess(res, allocations);
}));

router.get("/admin/:id/refunds", authenticate, requirePermission("invoices.read"), asyncHandler(async (req, res) => {
  const refunds = await getRefundsForInvoice(req.params["id"] as string);
  return sendSuccess(res, refunds);
}));

export default router;

