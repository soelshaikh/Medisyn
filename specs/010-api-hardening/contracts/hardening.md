# Contracts: API Hardening

**Feature**: `010-api-hardening` | **Date**: 2026-10-11

These contracts define the observable behaviour added or changed by this phase. They drive the integration test suite.

---

## Rate Limiting Contracts

### Global Rate Limit

**Applied to**: All `/api/v1/*` routes
**Window**: 1 minute per IP
**Limit**: 200 requests

**Success** (within limit):
```
HTTP 200 (or whatever the route normally returns)
Headers:
  RateLimit-Limit: 200
  RateLimit-Remaining: 199   (decrements each request)
  RateLimit-Reset: <seconds until window resets>
```

**Blocked** (limit exceeded):
```
HTTP 429 Too Many Requests
Headers:
  Retry-After: <seconds>
  RateLimit-Limit: 200
  RateLimit-Remaining: 0
Body:
  { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests, please try again later." } }
```

---

### Auth Strict Rate Limit

**Applied to**: `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/verify-email`
**Window**: 1 minute per IP
**Limit**: 5 requests

**Blocked** (limit exceeded):
```
HTTP 429 Too Many Requests
Headers:
  Retry-After: <seconds>
Body:
  { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests, please try again later." } }
```

---

### Healthcare Submissions Rate Limit

**Applied to**: `POST /api/v1/prescriptions`, `POST /api/v1/compounding`, `POST /api/v1/ask-pharmacist`
**Window**: 1 minute per IP
**Limit**: 10 requests

---

## Security Header Contracts

All `/api/v1/*` responses (and all other routes except `/api/docs`) MUST include:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-XSS-Protection` | `0` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

CORS — requests from allowed origins:
```
HTTP 200
Headers:
  Access-Control-Allow-Origin: <matched origin from ALLOWED_ORIGINS>
  Access-Control-Allow-Credentials: true
```

CORS — requests from disallowed origins:
```
HTTP 200 (simple) or HTTP 204 (preflight)
Headers:
  (no Access-Control-Allow-Origin header matching the request origin)
```

Body size exceeded:
```
HTTP 413 Payload Too Large
Body:
  { "error": { "code": "PAYLOAD_TOO_LARGE", "message": "Request body too large." } }
```

---

## OpenAPI Documentation Contracts

### `GET /api/docs`

**Authentication**: None required (public)
**Rate limit**: Subject to global 200/min limiter

**Success**:
```
HTTP 200
Content-Type: text/html
Body: Swagger UI HTML page listing all API modules and endpoints
```

### `GET /api/docs/swagger.json`

**Authentication**: None required
**Success**:
```
HTTP 200
Content-Type: application/json
Body: {
  "openapi": "3.0.0",
  "info": { "title": "MediSyn API", "version": "1.0.0" },
  "paths": { ... }   // all annotated endpoints
}
```

---

## Integration Test Contracts

These define the specific scenarios the test suite must verify.

### T-AUTH-01 — Login Happy Path

**Precondition**: A user with `email=test@medisyn.ca`, `password=TestPass123!` exists in the test DB and their facility is active.

**Request**:
```
POST /api/v1/auth/login
Content-Type: application/json
Body: { "email": "test@medisyn.ca", "password": "TestPass123!" }
```

**Expected response**:
```
HTTP 200
Body: {
  "data": {
    "accessToken": "<jwt string>",
    "user": { "id": "<uuid>", "email": "test@medisyn.ca", "role": "patient" }
  }
}
```

---

### T-AUTH-02 — Login Wrong Credentials

**Request**:
```
POST /api/v1/auth/login
Content-Type: application/json
Body: { "email": "test@medisyn.ca", "password": "WrongPassword" }
```

**Expected response**:
```
HTTP 401
Body: { "error": { "code": "INVALID_CREDENTIALS", "message": "..." } }
```

---

### T-AUTH-03 — Login Validation Failure

**Request**:
```
POST /api/v1/auth/login
Content-Type: application/json
Body: { "email": "not-an-email" }
```

**Expected response**:
```
HTTP 422
Body: { "error": { "code": "VALIDATION_ERROR", ... } }
```

---

### T-RX-01 — Prescription Submit Happy Path

**Precondition**: Authenticated patient user with valid `accessToken`.

**Request**:
```
POST /api/v1/prescriptions
Authorization: Bearer <accessToken>
Content-Type: application/json
Body: {
  "notes": "Need refill for blood pressure medication",
  "urgency": "routine"
}
```

**Expected response**:
```
HTTP 201
Body: {
  "data": {
    "id": "<uuid>",
    "status": "pending",
    "patientId": "<userId>",
    "createdAt": "<iso date>"
  }
}
```

---

### T-RX-02 — Prescription Submit Without Auth

**Request**:
```
POST /api/v1/prescriptions
Content-Type: application/json
Body: { "notes": "test" }
```

**Expected response**:
```
HTTP 401
Body: { "error": { "code": "UNAUTHORIZED", ... } }
```

---

### T-ORDER-01 — Cart Checkout Happy Path

**Precondition**: Authenticated patient user with a cart containing at least one product. Product exists in test DB with price > 0 and sufficient inventory.

**Request**:
```
POST /api/v1/checkout
Authorization: Bearer <accessToken>
Content-Type: application/json
Body: {
  "shippingAddressId": "<address uuid>",
  "shippingMethodId": "<method uuid>"
}
```

**Expected response**:
```
HTTP 201
Body: {
  "data": {
    "orderId": "<uuid>",
    "status": "pending",
    "total": <number>
  }
}
```

---

### T-APPT-01 — Appointment Booking Happy Path

**Precondition**: Authenticated patient user. A vaccine service and an availability slot with capacity exist in the test DB.

**Request**:
```
POST /api/v1/appointments
Authorization: Bearer <accessToken>
Content-Type: application/json
Body: {
  "availabilitySlotId": "<slot uuid>",
  "vaccineServiceId": "<service uuid>"
}
```

**Expected response**:
```
HTTP 201
Body: {
  "data": {
    "id": "<uuid>",
    "status": "booked",
    "patientId": "<userId>",
    "slotId": "<slot uuid>"
  }
}
```

---

### T-RATE-01 — Auth Rate Limit Enforced

**Precondition**: Fresh IP (or rate limit reset). Send 6 sequential login requests with wrong credentials.

**Expected**: First 5 requests → HTTP 401. 6th request → HTTP 429 with `Retry-After` header.

---

### T-SEC-01 — Security Headers Present

**Request**: `GET /health`

**Expected**: Response includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` header.
