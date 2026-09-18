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
  users:     { total: number; newToday: number };
  approvals: { pendingClinics: number; pendingPartners: number };
  orders:    { total: number; today: number; pending: number; byStatus: Array<{ _id: string; count: number }> };
  products:  { active: number; lowStock: number };
  revenue:   { totalCents: number; totalCAD: string };
  charts:    { dailyOrders: Array<{ _id: string; count: number; revenue: number }> };
}

export interface AdminOrder {
  _id:             string;
  orderNumber:     string;
  userId:          string | null;
  guestInfo:       { email: string; fullName: string; phone: string } | null;
  items:           Array<{ name: string; sku: string; price: number; quantity: number; lineTotal: number }>;
  shippingAddress: { fullName: string; city: string; province: string; postalCode: string };
  subtotal:        number;
  taxTotal:        number;
  discountAmount:  number;
  total:           number;
  couponCode:      string | null;
  paymentMethod:   string;
  status:          string;
  statusHistory:   StatusEntry[];
  notes:           string;
  createdAt:       string;
}

export interface AdminProduct {
  _id:                 string;
  name:                string;
  slug:                string;
  sku:                 string;
  shortDescription:    string;
  categoryId:          { _id: string; name: string; slug: string } | string;
  images:              Array<{ url: string; alt: string; isPrimary: boolean }>;
  price:               number;
  compareAtPrice:      number | null;
  requiresPrescription: boolean;
  status:              string;
  inventory?:          { quantity: number; lowStockThreshold: number; trackInventory: boolean };
  createdAt:           string;
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

export interface ListResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}
