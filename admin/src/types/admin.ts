export interface AdminUser {
  _id:           string;
  email:         string;
  fullName:      string;
  phone?:        string;
  role:          string;
  roles:         AdminRole[];
  status:        string;
  emailVerified: boolean;
  createdAt:     string;
}

export interface AdminRole {
  _id:         string;
  name:        string;
  slug:        string;
  description: string;
  permissions: string[];
  isSystem:    boolean;
}

export interface ClinicProfile {
  clinicName:    string;
  contactName:   string;
  clinicPhone:   string;
  clinicAddress: string;
  licenseNumber: string;
  website:       string;
}

export interface PartnerProfile {
  companyName:   string;
  contactName:   string;
  phone:         string;
  address:       string;
  licenseNumber: string;
  website:       string;
}

export interface ClinicUser extends AdminUser {
  profile: ClinicProfile | null;
}

export interface PartnerUser extends AdminUser {
  profile: PartnerProfile | null;
}

export interface FAQ {
  _id:         string;
  question:    string;
  answer:      string;
  category:    string;
  sortOrder:   number;
  isPublished: boolean;
  createdAt:   string;
}

export interface AuditLog {
  _id:        string;
  userId:     string | null;
  userEmail:  string;
  action:     string;
  resource:   string;
  resourceId: string;
  details:    Record<string, unknown>;
  ipAddress:  string;
  createdAt:  string;
}

export interface DashboardMetrics {
  users:      { total: number; newToday: number };
  approvals:  { pendingClinics: number; pendingPartners: number };
  orders:     { total: number; today: number; pending: number; byStatus: Array<{ _id: string; count: number }> };
  products:   { active: number; lowStock: number };
  revenue:    { totalCents: number; totalCAD: string };
  charts:     { dailyOrders: Array<{ _id: string; count: number; revenue: number }> };
  healthcare: {
    pendingCompounding: number;
    openAskPharmacist:  number;
    pendingAppointments: number;
    activePrescriptions: number;
  };
}

export interface BatchAllocation {
  productId:   string;
  productName: string;
  batchId:     string;
  batchNumber: string;
  expiryDate:  string;
  allocatedQty: number;
}

export interface ProductBatch {
  _id:              string;
  productId:        string;
  batchNumber:      string;
  expiryDate:       string;
  manufacturedDate: string | null;
  receivedDate:     string;
  initialQty:       number;
  currentQty:       number;
  status:           "active" | "depleted" | "expired" | "recalled";
  notes:            string;
  recallReason:     string | null;
  recalledAt:       string | null;
  supplier:         string | null;
  purchaseOrderRef: string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface InventoryMovement {
  _id:          string;
  productId:    string;
  batchId:      string;
  batchNumber:  string;
  movementType: string;
  qty:          number;
  qtyBefore:    number;
  qtyAfter:     number;
  orderId:      string | null;
  orderNumber:  string | null;
  performedBy:  string | null;
  notes:        string;
  createdAt:    string;
}

export interface AdminOrder {
  _id:              string;
  orderNumber:      string;
  userId:           { _id: string; email: string; fullName: string; phone?: string } | string | null;
  guestInfo:        { email: string; fullName: string; phone: string } | null;
  items:            Array<{ name: string; sku: string; price: number; quantity: number; lineTotal: number }>;
  batchAllocations: BatchAllocation[];
  shippingAddress:  { fullName: string; city: string; province: string; postalCode: string };
  subtotal:         number;
  taxTotal:         number;
  discountAmount:   number;
  total:            number;
  couponCode:       string | null;
  paymentMethod:    string;
  status:           string;
  statusHistory:    StatusEntry[];
  notes:            string;
  createdAt:        string;
}

export interface AdminBrand {
  _id:         string;
  name:        string;
  slug:        string;
  description: string;
  logoUrl:     string;
  website:     string;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface AdminProduct {
  _id:                 string;
  name:                string;
  slug:                string;
  sku:                 string;
  description:         string;
  shortDescription:    string;
  categoryId:          { _id: string; name: string; slug: string } | string;
  brandId:             { _id: string; name: string; slug: string } | string | null;
  din:                 string;
  upc:                 string;
  images:              Array<{ url: string; alt: string; isPrimary: boolean }>;
  videoUrls:           string[];
  price:               number;
  compareAtPrice:      number | null;
  requiresPrescription: boolean;
  ageRestriction:      number | null;
  status:              string;
  tags:                string[];
  weight:              number | null;
  metaTitle:           string;
  metaDescription:     string;
  inventory?:          {
    quantity:             number;
    lowStockThreshold:    number;
    trackInventory:       boolean;
    batchTrackingEnabled: boolean;
    nearExpiryAlertDays:  number;
  };
  createdAt:           string;
  updatedAt:           string;
}

export interface AdminCoupon {
  _id:              string;
  code:             string;
  type:             string;
  value:            number;
  minOrderAmount:   number | null;
  usageLimit:       number | null;
  usageCount:       number;
  firstOrderOnly:   boolean;
  startDate:        string | null;
  expiresAt:        string | null;
  isActive:         boolean;
  createdAt:        string;
}

export interface StatusEntry {
  status:        string;
  changedAt:     string;
  changedByName: string;
  note:          string;
}

export interface AdminPrescription {
  _id:                string;
  patientId:          string | { _id: string; fullName: string; email: string };
  prescriptionNumber: string;
  prescriberName:     string;
  prescriberLicense:  string;
  prescriberPhone:    string;
  medicationName:     string;
  dosage:             string;
  refillsRemaining:   number;
  expiresAt:          string | null;
  notes:              string;
  status:             string;
  statusHistory:      StatusEntry[];
  createdAt:          string;
}

export interface AdminCompoundingRequest {
  _id:               string;
  patientId:         string | { _id: string; fullName: string; email: string };
  medicationName:    string;
  strength:          string;
  form:              string;
  quantity:          string;
  prescriberName:    string;
  prescriberLicense: string;
  notes:             string;
  fileUrl:           string;
  status:            string;
  quoteAmount:       number | null;
  quoteNote:         string;
  statusHistory:     StatusEntry[];
  createdAt:         string;
}

export interface AdminAskPharmacist {
  _id:           string;
  patientId:     string | { _id: string; fullName: string; email: string };
  subject:       string;
  question:      string;
  fileUrl:       string;
  status:        string;
  responseText:  string;
  respondedAt:   string | null;
  statusHistory: StatusEntry[];
  createdAt:     string;
}

export interface VaccineService {
  _id:             string;
  name:            string;
  slug:            string;
  description:     string;
  eligibilityNotes:string;
  durationMinutes: number;
  status:          "active" | "inactive";
  sortOrder:       number;
  createdAt:       string;
}

export interface AppointmentSlot {
  _id:              string;
  vaccineServiceId: VaccineService | string;
  date:             string;
  startTime:        string;
  endTime:          string;
  capacity:         number;
  bookedCount:      number;
  capacityType:     "strict" | "open";
  status:           "active" | "cancelled";
  createdAt:        string;
}

export interface AppointmentBooking {
  _id:              string;
  slotId:           AppointmentSlot | string;
  patientId:        { _id: string; fullName: string; email: string; phone?: string } | string;
  vaccineServiceId: VaccineService | string;
  status:           string;
  statusHistory:    StatusEntry[];
  patientNotes:     string;
  adminNotes?:      string;
  adminReply?:      string;
  cancelledAt:      string | null;
  cancelledBy:      "patient" | "admin" | null;
  cancellationReason: string;
  createdAt:        string;
}

export interface AdminAilmentRequest {
  _id:          string;
  patientId:    string | { _id: string; fullName: string; email: string; phone?: string };
  ailmentId:    string;
  ailmentName:  string;
  formData:     Record<string, unknown>;
  notes:        string;
  status:       string;
  responseText: string;
  respondedAt:  string | null;
  statusHistory: StatusEntry[];
  adminNotes:   string;
  createdAt:    string;
}

export type InvoiceStatus        = "draft" | "finalized" | "cancelled" | "system_cancelled";
export type InvoicePaymentStatus = "unpaid" | "partial_paid" | "paid" | "overpaid" | "cancelled" | "system_cancelled";
export type PaymentMethod        = "cash" | "card" | "e_transfer" | "cheque";

export interface InvoiceAddress {
  fullName:     string;
  phone:        string;
  addressLine1: string;
  addressLine2?: string;
  city:         string;
  province:     string;
  postalCode:   string;
  country:      string;
}

export interface InvoiceTaxLine {
  label:  string;
  rate:   number;
  amount: number;
}

/* Separate collection — returned as lineItems[] in detail view */
export interface InvoiceLineItem {
  _id:            string;
  invoiceId:      string;
  productId?:     string;
  name:           string;
  sku:            string;
  description?:   string;
  quantity:       number;
  unitPrice:      number;
  discountAmount: number;
  lineTotal:      number;
  sortOrder:      number;
  createdAt:      string;
  updatedAt:      string;
}

export interface InvoiceLineItemHistory {
  _id:        string;
  lineItemId: string;
  invoiceId:  string;
  action:     "created" | "updated" | "deleted";
  before?:    Record<string, unknown>;
  after?:     Record<string, unknown>;
  changedBy:  { id: string; name: string; email: string };
  reason?:    string;
  changedAt:  string;
}

export type PaymentTransactionStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";
export type PaymentTransactionType   = "payment" | "refund";

export interface PaymentStatusHistoryEntry {
  status:    PaymentTransactionStatus;
  changedBy: { id: string; name: string; email: string } | null;
  changedAt: string;
  note?:     string;
}

export interface PaymentTransaction {
  _id:               string;
  type:              PaymentTransactionType;
  amount:            number;
  currency:          string;
  method:            PaymentMethod;
  reference?:        string;
  status:            PaymentTransactionStatus;
  payerId?:          string;
  payerName?:        string;
  payerEmail?:       string;
  amountAllocated:   number;
  amountUnallocated: number;
  recordedBy:        { id: string; name: string; email: string };
  /* Refund-specific */
  refundOf?:          string | PaymentTransaction;
  refundReason?:      string;
  processedBy?:       { id: string; name: string; email: string };
  processedAt?:       string;
  failureReason?:     string;
  financiallySettled: boolean;
  statusHistory:      PaymentStatusHistoryEntry[];
  notes?:             string;
  createdAt:          string;
  updatedAt:          string;
  /* Populated in detail view */
  allocations?:       PaymentAllocation[];
  refunds?:           PaymentTransaction[];
}

export interface PaymentAllocation {
  _id:           string;
  transactionId: string | PaymentTransaction;
  invoiceId:     string;
  amount:        number;
  allocatedBy:   { id: string; name: string; email: string };
  notes?:        string;
  createdAt:     string;
}

export interface AdminInvoice {
  _id:            string;
  invoiceNumber:  string;
  type:           "ecommerce" | "adhoc";
  status:         InvoiceStatus;
  paymentStatus:  InvoicePaymentStatus;
  orderId?:       string;
  orderNumber?:   string;
  customerId?:    string;
  customerName:   string;
  customerEmail:  string;
  billingAddress: InvoiceAddress;
  subtotal:       number;
  discountAmount: number;
  couponCode?:    string;
  taxLines:       InvoiceTaxLine[];
  taxTotal:       number;
  total:          number;
  amountPaid:     number;
  amountDue:      number;
  notes?:         string;
  internalNotes?: string;
  guestToken?:    string;
  issuedAt?:      string;
  cancelledAt?:   string;
  cancelReason?:  string;
  createdAt:      string;
  updatedAt:      string;
  /* Populated in detail view */
  lineItems?:     InvoiceLineItem[];
}

export interface RefundReport {
  totalRefunded:  number;
  pendingAmount:  number;
  pendingCount:   number;
  completedCount: number;
  failedCount:    number;
  cancelledCount: number;
  byMethod: {
    cash:      number;
    card:      number;
    eTransfer: number;
    cheque:    number;
  };
}

export interface InvoiceSummary {
  totalRevenue:   number;
  totalTax:       number;
  totalDiscount:  number;
  totalPaid:      number;
  totalDue:       number;
  count:          number;
  ecommerceCount: number;
  adhocCount:     number;
  unpaidCount:    number;
  partialCount:   number;
  paidCount:      number;
  refunds:        RefundReport;
}

export interface ListResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}
