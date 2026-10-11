/* Backend API contract types for the admin auth endpoints */

export interface LoginRequest {
  email: string;
  password: string;
}

/* POST /api/v1/auth/super-admin/login */
export interface SuperAdminLoginResponse {
  data: {
    accessToken: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
}

/* GET /api/v1/auth/me */
export interface MeResponse {
  data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
    role: string | null;
    facilityId: string | null;
    unreadCount: number;
  };
}

/* POST /api/v1/auth/refresh */
export interface RefreshResponse {
  data: {
    accessToken: string;
  };
}

/* Standard error envelope */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
