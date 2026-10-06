# Quickstart & Validation Guide: Auth Endpoints (002)

## Prerequisites

Phase 1 gate tests must be green before Phase 2 begins.

```sh
# From backend/
docker compose up -d
psql $DATABASE_ADMIN_URL -f scripts/create-roles.sql
npm run db:migrate
psql $DATABASE_ADMIN_URL -f src/db/rls/current-facility-id.sql
psql $DATABASE_ADMIN_URL -f scripts/grant-permissions.sql
psql $DATABASE_ADMIN_URL -f src/db/rls/policies.sql
npm run db:seed
npm run test -- tests/isolation/  # all 20 Phase 1 tests must be green
```

## Step 1 — Install Phase 2 dependencies

```sh
cd backend
npm install nodemailer
npm install --save-dev @types/nodemailer
```

## Step 2 — Seed a test facility

Phase 2 requires at least one active facility with slug `test-pharmacy` in the database. Run the Phase 2 seed or insert manually:

```sh
npm run db:seed:facilities    # adds test-pharmacy (created as part of Phase 2 seed)
```

Or manually via psql:

```sql
INSERT INTO facilities (id, name, slug, status, settings)
VALUES (gen_random_uuid(), 'Test Pharmacy', 'test-pharmacy', 'active', '{}')
ON CONFLICT (slug) DO NOTHING;
```

## Step 3 — Start the dev server

```sh
npm run dev   # Express on PORT=3001 (or env PORT)
```

## Step 4 — Run Phase 2 gate tests

```sh
npm run test -- tests/auth/
```

Expected: all auth tests green.

---

## Manual Smoke Tests

Use `curl` or any HTTP client. Substitute `PORT` with the running port (default 3001).

### S1 — Register a new patient

```sh
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "password": "password123",
    "facilitySlug": "test-pharmacy"
  }'
```

Expected: `201 Created` with `{ "data": { "message": "...", "userId": "uuid" } }`

### S2 — Registration duplicate (same facility)

```sh
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "firstName":"Jane","lastName":"Doe","email":"jane@example.com","password":"password123","facilitySlug":"test-pharmacy" }'
```

Expected: `409 Conflict` with `{ "error": { "code": "EMAIL_IN_USE", ... } }`

### S3 — Register at a second facility (cross-pharmacy linking)

```sh
# First create a second facility via psql
# INSERT INTO facilities ... slug = 'second-pharmacy' ...

curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "firstName":"Jane","lastName":"Doe","email":"jane@example.com","password":"password123","facilitySlug":"second-pharmacy" }'
```

Expected: `201 Created` (same userId, new facilityUsers link)

### S4 — Login

```sh
curl -c cookies.txt -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email":"jane@example.com","password":"password123","facilitySlug":"test-pharmacy" }'
```

Expected: `200 OK` with `{ "data": { "accessToken": "eyJ...", "user": { ... } } }` and `Set-Cookie: refresh_token=...` header.

Save the `accessToken` value for subsequent steps.

### S5 — Invalid credentials (no enumeration)

```sh
# Wrong password
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email":"jane@example.com","password":"wrongpassword","facilitySlug":"test-pharmacy" }'

# Non-existent email
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email":"nobody@example.com","password":"password123","facilitySlug":"test-pharmacy" }'
```

Expected: Both return identical `401` with `{ "error": { "code": "INVALID_CREDENTIALS" } }`

### S6 — Authenticated ping (verify access token works)

```sh
ACCESS_TOKEN="eyJ..."  # from S4
curl -X GET http://localhost:3001/api/v1/ping \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: `200 OK` with `{ "userId": "...", "facilityId": "..." }`

### S7 — Token refresh

```sh
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json"
```

Expected: `200 OK` with new `accessToken` in body and new `refresh_token` cookie set.

### S8 — Logout (single session)

```sh
curl -b cookies.txt -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Expected: `200 OK`. Subsequent use of `ACCESS_TOKEN` on any protected route returns `401 SESSION_REVOKED`.

### S9 — Forgot password (no enumeration)

```sh
# Registered email
curl -X POST http://localhost:3001/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{ "email":"jane@example.com" }'

# Unregistered email
curl -X POST http://localhost:3001/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{ "email":"ghost@example.com" }'
```

Expected: Both return identical `200 OK` with the same message.

### S10 — Complete password reset

```sh
# Retrieve the reset token from the database (test only — not exposed via API)
TOKEN=$(psql $DATABASE_ADMIN_URL -tAc "SELECT password_reset_token FROM users WHERE email='jane@example.com'")

curl -X POST http://localhost:3001/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{ \"token\": \"$TOKEN\", \"password\": \"newpassword456\" }"
```

Expected: `200 OK`. Old sessions rejected. Login with new password succeeds.

### S11 — Email verification

```sh
TOKEN=$(psql $DATABASE_ADMIN_URL -tAc "SELECT email_verify_token FROM users WHERE email='jane@example.com'")

curl -X POST http://localhost:3001/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{ \"token\": \"$TOKEN\" }"
```

Expected: `200 OK`. `users.email_verified = true` in DB.

---

## Phase 2 Gate Checklist

Before running `/speckit-tasks`, confirm:

- [ ] `npm run test -- tests/auth/` — all auth tests green
- [ ] S1–S11 smoke tests pass manually
- [ ] `npm run lint` — zero errors
- [ ] `npm run typecheck` — zero errors
- [ ] All 10 error codes in `contracts/auth-endpoints.md` are exercised by tests
- [ ] `auditLog` contains one row per auth event after smoke tests
- [ ] `refresh_token` cookie is HttpOnly (confirm via browser DevTools or curl `-v` headers)
- [ ] Identical error response for valid/invalid email on login (S5) and forgot-password (S9)
