# Quickstart: API Hardening Validation

**Feature**: `010-api-hardening` | **Date**: 2026-10-11

---

## Prerequisites

1. Backend installed: `cd backend && npm install`
2. A running PostgreSQL instance accessible via `DATABASE_URL` (dev) and `TEST_DATABASE_URL` (tests)
3. `.env` in `backend/` includes:
   ```
   DATABASE_URL=postgres://...
   TEST_DATABASE_URL=postgres://.../<test_db_name>
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
   NODE_ENV=development
   JWT_SECRET=<any string for dev>
   ```
4. Test database migrated: `TEST_DATABASE_URL=<url> npm run db:migrate` (run once)

---

## Scenario 1 — Global Rate Limiter Header Presence

Start the dev server: `npm run dev`

```bash
curl -i http://localhost:4000/api/v1/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"x@x.com","password":"wrong"}'
```

**Expected headers in response**:
```
RateLimit-Limit: 200
RateLimit-Remaining: 199
```

---

## Scenario 2 — Auth Strict Rate Limit (5/min)

Send 6 rapid login requests from the same IP:

```bash
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:4000/api/v1/auth/login \
    -X POST -H 'Content-Type: application/json' \
    -d '{"email":"x@x.com","password":"wrong"}'
done
```

**Expected output**: First 5 lines → `401`, 6th line → `429`

---

## Scenario 3 — CORS Blocked from Unlisted Origin

```bash
curl -i http://localhost:4000/api/v1/auth/login \
  -H 'Origin: https://evil.com' \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"x@x.com","password":"wrong"}'
```

**Expected**: No `Access-Control-Allow-Origin: https://evil.com` header in response.

---

## Scenario 4 — CORS Accepted from Allowed Origin

```bash
curl -i http://localhost:4000/api/v1/auth/login \
  -H 'Origin: http://localhost:3000' \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"x@x.com","password":"wrong"}'
```

**Expected**: `Access-Control-Allow-Origin: http://localhost:3000` present in response.

---

## Scenario 5 — Security Headers Present

```bash
curl -i http://localhost:4000/health
```

**Expected headers**:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Scenario 6 — Body Too Large (413)

```bash
# Generate a 2MB payload
python3 -c "import json; print(json.dumps({'data': 'x'*2*1024*1024}))" > /tmp/big.json
curl -i http://localhost:4000/api/v1/auth/login \
  -X POST -H 'Content-Type: application/json' \
  -d @/tmp/big.json
```

**Expected**: `HTTP 413 Payload Too Large` with `{ "error": { "code": "PAYLOAD_TOO_LARGE" } }`

---

## Scenario 7 — Swagger UI Accessible

Open in browser: `http://localhost:4000/api/docs`

**Expected**: Interactive Swagger UI page loads. Auth module endpoints visible. Can expand `POST /api/v1/auth/login` and see request/response schema.

---

## Scenario 8 — Swagger JSON Endpoint

```bash
curl -s http://localhost:4000/api/docs/swagger.json | jq '.info'
```

**Expected**:
```json
{
  "title": "MediSyn API",
  "version": "1.0.0",
  "description": "MediSyn healthcare platform REST API"
}
```

---

## Scenario 9 — Run Integration Test Suite

```bash
cd backend
TEST_DATABASE_URL=postgres://<host>/<test_db> npm test
```

**Expected output**:
```
PASS tests/auth/login.test.ts
PASS tests/healthcare/prescriptions.test.ts
PASS tests/commerce/checkout.test.ts
PASS tests/appointments/appointments.test.ts

Test Suites: 4 passed, 4 total
Tests:       8 passed, 8 total
```

Process exits with code `0`.

---

## Scenario 10 — Test Suite Fails on Broken Login

Introduce a deliberate bug: in `backend/src/core/auth/auth.router.ts`, change the login endpoint to return 500 unconditionally, then run `npm test`.

**Expected**: `tests/auth/login.test.ts` fails with a descriptive assertion error. Other test suites continue and report their own results. Process exits with code `1`.

Revert the change after verifying.

---

## Deferred (Requires Running Backend + DB)

| Scenario | Blocker |
|----------|---------|
| S1–S8 | Requires `npm run dev` + env vars |
| S9–S10 | Requires `TEST_DATABASE_URL` pointing to a live test DB |
