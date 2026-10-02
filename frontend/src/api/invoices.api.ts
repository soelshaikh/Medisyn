import { apiClient } from "@/lib/apiClient";

export interface MyInvoice {
  _id:            string;
  invoiceNumber:  string;
  type:           "ecommerce" | "adhoc";
  status:         "issued" | "void";
  orderId?:       string;
  orderNumber?:   string;
  customerName:   string;
  customerEmail:  string;
  total:          number;
  taxTotal:       number;
  subtotal:       number;
  discountAmount: number;
  items:          Array<{ name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
  taxLines:       Array<{ label: string; rate: number; amount: number }>;
  billingAddress: {
    fullName: string; addressLine1: string; addressLine2?: string;
    city: string; province: string; postalCode: string; country: string;
  };
  notes?:         string;
  issuedAt:       string;
  createdAt:      string;
}

export const invoicesApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<{ success: boolean; data: MyInvoice[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        "/invoices/my",
        { params: { page, limit } },
      )
      .then((r) => r.data.data),

  getById: (id: string) =>
    apiClient
      .get<{ success: boolean; data: MyInvoice }>(`/invoices/my/${id}`)
      .then((r) => r.data.data),

  downloadPdf: async (id: string, filename?: string): Promise<void> => {
    const response = await apiClient.get(`/invoices/my/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `invoice-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
