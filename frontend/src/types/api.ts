/* Shared API response shapes */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiListResponse<T = unknown> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  statusCode: number;
  details?: Record<string, string[]>;
}

/* Common query params */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SearchParams extends PaginationParams {
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
