export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  /* PHIPA / PIPEDA / CASL consent */
  termsAccepted: true;
  privacyAccepted: true;
  marketingConsent?: boolean;
  privacyPolicyVersion?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: "patient" | "clinic" | "pharmacy_partner";
  roles: string[];
  permissions: string[];
  status: "pending_verification" | "active" | "suspended" | "deactivated";
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
