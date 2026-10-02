import apiClient from "@/lib/apiClient";
import type {
  AdminInvoice, InvoiceLineItem, InvoiceLineItemHistory,
  InvoiceSummary, InvoiceAddress, InvoiceTaxLine,
  PaymentTransaction, PaymentAllocation, PaymentMethod,
} from "@/types/admin";

const BASE = "/invoices";

/* ─── Shared types ─────────────────────────────────────────────────────────── */

interface ListMeta { page: number; limit: number; total: number; totalPages: number }
interface ListResult<T> { data: T[]; meta: ListMeta }

export interface LineItemInput {
  name:           string;
  sku:            string;
  description?:   string;
  productId?:     string;
  quantity:       number;
  unitPrice:      number;
  discountAmount?: number;
}

export interface AdhocInvoicePayload {
  customerName:   string;
  customerEmail:  string;
  customerId?:    string;
  billingAddress: InvoiceAddress;
  items?: LineItemInput[];
  taxLines?:       InvoiceTaxLine[];
  discountAmount?: number;
  couponCode?:     string;
  notes?:          string;
  internalNotes?:  string;
}

export interface CreateTransactionPayload {
  amount:     number;
  method:     PaymentMethod;
  reference?: string;
  payerId?:   string;
  payerName?: string;
  payerEmail?: string;
  notes?:     string;
}

/* ─── Invoice endpoints ────────────────────────────────────────────────────── */

export const invoicesApi = {
  /* List */
  list: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ success: boolean } & ListResult<AdminInvoice>>(`${BASE}/admin`, { params })
      .then((r) => r.data as ListResult<AdminInvoice>),

  /* Detail (includes lineItems[]) */
  getById: (id: string) =>
    apiClient
      .get<{ data: AdminInvoice }>(`${BASE}/admin/${id}`)
      .then((r) => r.data.data),

  /* Download PDF */
  downloadPdf: async (id: string, filename?: string): Promise<void> => {
    const response = await apiClient.get(`${BASE}/admin/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: "application/pdf" }));
    const a   = document.createElement("a");
    a.href = url; a.download = filename ?? `invoice-${id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  },

  /* Create adhoc draft */
  createAdhoc: (payload: AdhocInvoicePayload) =>
    apiClient
      .post<{ data: AdminInvoice }>(`${BASE}/admin/adhoc`, payload)
      .then((r) => r.data.data),

  /* Finalize draft */
  finalize: (id: string) =>
    apiClient
      .patch<{ data: AdminInvoice }>(`${BASE}/admin/${id}/finalize`)
      .then((r) => r.data.data),

  /* Cancel */
  cancel: (id: string, reason: string) =>
    apiClient
      .patch<{ data: AdminInvoice }>(`${BASE}/admin/${id}/cancel`, { reason })
      .then((r) => r.data.data),

  /* Update draft header (discount, tax, notes) */
  updateHeader: (id: string, payload: {
    discountAmount?: number;
    couponCode?: string;
    taxLines?: InvoiceTaxLine[];
    notes?: string;
    internalNotes?: string;
  }) =>
    apiClient
      .patch<{ data: AdminInvoice }>(`${BASE}/admin/${id}/header`, payload)
      .then((r) => r.data.data),

  /* Summary report */
  summary: (params?: { dateFrom?: string; dateTo?: string }) =>
    apiClient
      .get<{ data: InvoiceSummary }>(`${BASE}/admin/reports/summary`, { params })
      .then((r) => r.data.data),
};

/* ─── Line item endpoints ──────────────────────────────────────────────────── */

export const lineItemsApi = {
  list: (invoiceId: string) =>
    apiClient
      .get<{ data: InvoiceLineItem[] }>(`${BASE}/admin/${invoiceId}/line-items`)
      .then((r) => r.data.data),

  history: (invoiceId: string) =>
    apiClient
      .get<{ data: InvoiceLineItemHistory[] }>(`${BASE}/admin/${invoiceId}/line-items/history`)
      .then((r) => r.data.data),

  add: (invoiceId: string, payload: LineItemInput) =>
    apiClient
      .post<{ data: InvoiceLineItem }>(`${BASE}/admin/${invoiceId}/line-items`, payload)
      .then((r) => r.data.data),

  update: (invoiceId: string, itemId: string, payload: Partial<LineItemInput>) =>
    apiClient
      .patch<{ data: InvoiceLineItem }>(`${BASE}/admin/${invoiceId}/line-items/${itemId}`, payload)
      .then((r) => r.data.data),

  delete: (invoiceId: string, itemId: string) =>
    apiClient
      .delete(`${BASE}/admin/${invoiceId}/line-items/${itemId}`),
};

/* ─── Payment endpoints ────────────────────────────────────────────────────── */

export const paymentsApi = {
  /* Transactions */
  listTransactions: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ success: boolean } & ListResult<PaymentTransaction>>(`${BASE}/admin/payments`, { params })
      .then((r) => r.data as ListResult<PaymentTransaction>),

  getTransaction: (txId: string) =>
    apiClient
      .get<{ data: PaymentTransaction }>(`${BASE}/admin/payments/${txId}`)
      .then((r) => r.data.data),

  createTransaction: (payload: CreateTransactionPayload) =>
    apiClient
      .post<{ data: PaymentTransaction }>(`${BASE}/admin/payments`, payload)
      .then((r) => r.data.data),

  /* Allocations */
  allocate: (txId: string, payload: { invoiceId: string; amount: number; notes?: string }) =>
    apiClient
      .post<{ data: PaymentAllocation }>(`${BASE}/admin/payments/${txId}/allocate`, payload)
      .then((r) => r.data.data),

  /* Manual refund on a finalized invoice */
  refund: (txId: string, payload: {
    invoiceId: string;
    amount:    number;
    reason:    string;
    method:    PaymentMethod;
    notes?:    string;
  }) =>
    apiClient
      .post<{ data: PaymentTransaction }>(`${BASE}/admin/payments/${txId}/refund`, payload)
      .then((r) => r.data.data),

  /* Get all allocations for an invoice */
  getAllocationsForInvoice: (invoiceId: string) =>
    apiClient
      .get<{ data: PaymentAllocation[] }>(`${BASE}/admin/${invoiceId}/payments`)
      .then((r) => r.data.data),

  /* Get all refund transactions for an invoice */
  getRefundsForInvoice: (invoiceId: string) =>
    apiClient
      .get<{ data: PaymentTransaction[] }>(`${BASE}/admin/${invoiceId}/refunds`)
      .then((r) => r.data.data),

  /* All pending refunds (queue management) */
  listPendingRefunds: (params?: Record<string, unknown>) =>
    apiClient
      .get<{ success: boolean } & ListResult<PaymentTransaction>>(`${BASE}/admin/payments/pending-refunds`, { params })
      .then((r) => r.data as ListResult<PaymentTransaction>),

  /* Process a pending refund — applies financial changes */
  processRefund: (txId: string, note?: string) =>
    apiClient
      .patch<{ data: PaymentTransaction }>(`${BASE}/admin/payments/${txId}/process-refund`, { note })
      .then((r) => r.data.data),

  /* Mark a pending refund as failed */
  failRefund: (txId: string, reason: string) =>
    apiClient
      .patch<{ data: PaymentTransaction }>(`${BASE}/admin/payments/${txId}/fail-refund`, { reason })
      .then((r) => r.data.data),

  /* Cancel a pending refund */
  cancelRefund: (txId: string, reason: string) =>
    apiClient
      .patch<{ data: PaymentTransaction }>(`${BASE}/admin/payments/${txId}/cancel-refund`, { reason })
      .then((r) => r.data.data),
};
