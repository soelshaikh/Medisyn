# Data Model: Admin Panel Scaffold

**Feature**: Admin Panel Scaffold (`specs/011-admin-panel-scaffold`)
**Date**: 2026-10-11

This feature introduces no new database tables. All data originates from the Express backend. This document defines the TypeScript types and client-side state shapes used within the `admin/` app.

---

## 1. AdminUser

Represents the platform super-admin user profile stored in the Zustand auth store after login. Sourced from the backend `POST /api/v1/auth/super-admin/login` response and/or `GET /api/v1/auth/me`.

```typescript
// src/types/auth.ts
export interface AdminUser {
  id: string;           // UUID — matches JWT `sub` claim
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean; // always true for users in this store
}
```

**Validation rules**:
- `id`: non-empty UUID string
- `email`: valid email format
- `firstName` / `lastName`: non-empty strings
- `isSuperAdmin`: must be `true` — any user with `false` is rejected by the route guard

---

## 2. AuthState (Zustand Store)

The auth store is the single source of truth for the admin's session. Persisted to `localStorage` under key `admin-auth` using Zustand `persist` middleware.

```typescript
// src/stores/authStore.ts
export interface AuthState {
  accessToken: string | null;
  user: AdminUser | null;
}

export interface AuthActions {
  setSession: (accessToken: string, user: AdminUser) => void;
  clearSession: () => void;
}

// Full store type:
// AuthState & AuthActions
```

**State transitions**:
- Initial / logged-out: `{ accessToken: null, user: null }`
- After login: `{ accessToken: "<jwt>", user: { id, email, firstName, lastName, isSuperAdmin: true } }`
- After logout / expiry: `{ accessToken: null, user: null }` (same as initial)

**Persistence**: The `persist` middleware serializes `{ accessToken, user }` to `localStorage['admin-auth']`. Actions are not persisted.

---

## 3. JwtPayload

Shape of the decoded JWT access token payload. Used by the route guard to check expiry and `isSuperAdmin`. Decoded via base64 — **never verified client-side** (verification is the backend's responsibility).

```typescript
// src/types/auth.ts
export interface JwtPayload {
  sub: string;           // userId
  sessionId: string;
  facilityId: string | null;
  authVersion: number;
  role: string;          // "super_admin"
  isSuperAdmin: boolean;
  iat: number;           // issued at (Unix seconds)
  exp: number;           // expiry (Unix seconds)
}
```

**Helper**:
```typescript
// src/lib/decodeJwt.ts
export function decodeJwtPayload(token: string): JwtPayload | null
```
Splits on `.`, base64-decodes the payload segment, JSON-parses. Returns `null` on any error.

---

## 4. LoginFormData

Inputs collected from the login form.

```typescript
// src/types/auth.ts
export interface LoginFormData {
  email: string;    // validated: non-empty, valid email format
  password: string; // validated: non-empty, min 8 chars (same constraint as backend)
}
```

---

## 5. API Response Types

Types for backend responses consumed by the `src/api/auth.ts` functions.

```typescript
// src/types/auth.ts

export interface LoginApiResponse {
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

export interface MeApiResponse {
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

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}
```

---

## 6. Derived / Computed Values

The following values are derived at runtime — they are never stored directly:

| Derived Value | Source | Where Used |
|---|---|---|
| `isAuthenticated` | `authStore.accessToken !== null && !isExpired(accessToken)` | Route guard, `(protected)/layout.tsx` |
| `displayName` | `user.firstName + ' ' + user.lastName` | TopHeader component |
| `isExpired` | decode `exp` from access token, compare to `Date.now() / 1000` | Route guard, Axios 401 interceptor |
