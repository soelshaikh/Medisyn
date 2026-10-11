# Research: API Hardening

**Feature**: `010-api-hardening` | **Date**: 2026-10-11

---

## D1 — Rate Limiting: Library and Window Strategy

**Decision**: Keep `express-rate-limit` (already installed). Switch from a single global 300/15-min limiter to three named limiters with 1-minute windows: global (200/min), auth-strict (5/min), healthcare-submissions (10/min).

**Rationale**: The current global limiter (300 requests / 15 minutes ≈ 20/min) is actually *more* restrictive than the spec's 200/min global target. Replacing it with a 1-minute window makes the reset cycle visible to clients via `Retry-After`. Three named limiters live in `src/middleware/rate-limit.ts` and are applied as Express middleware before the route handler — the global one on `/api/v1`, the strict ones on specific router groups.

**`Retry-After` header**: `express-rate-limit` v7+ emits `RateLimit-*` standard headers and supports `Retry-After` via `standardHeaders: 'draft-7'` option. Set `legacyHeaders: false` to suppress the old `X-RateLimit-*` headers.

**Rate limit store**: Default in-memory store is sufficient for MVP. A Redis store (`rate-limit-redis`) can be swapped in later when horizontal scaling requires shared state. No Redis dependency introduced this phase.

**Alternatives considered**:
- `express-slow-down` — adds delay rather than blocking; rejected because it does not enforce a hard cap.
- `node-rate-limiter-flexible` — more flexible but requires Redis or DB store; overkill for single-instance MVP.

---

## D2 — CORS: Consolidate to `ALLOWED_ORIGINS`

**Decision**: Replace the two-variable approach (`FRONTEND_URL` + `ADMIN_URL`) with a single `ALLOWED_ORIGINS` environment variable containing a comma-separated list. At startup, parse and validate the list; in production mode (`NODE_ENV=production`), throw if `ALLOWED_ORIGINS` is empty or absent — fail fast rather than default to wildcard.

**Implementation**:
```
ALLOWED_ORIGINS=https://medisyn.ca,https://admin.medisyn.ca
```
In dev, if `ALLOWED_ORIGINS` is unset, fall back to `['http://localhost:3000', 'http://localhost:3002']`. In production, absence is a startup crash.

**Backward compatibility**: `FRONTEND_URL` and `ADMIN_URL` env vars are no longer read for CORS. Update `.env.example` to reflect the new variable.

**Rationale**: A single variable is easier to configure in CI/CD (one secret, not two). The fail-fast behaviour prevents a misconfiguration from silently permitting all origins.

**Alternatives considered**:
- Keep `FRONTEND_URL` + `ADMIN_URL` — rejected because it doesn't scale (what about a third client?) and is inconsistent with the spec requirement for a single allowlist variable.

---

## D3 — Helmet: Explicit Configuration

**Decision**: Replace bare `helmet()` with an explicit options object covering the four areas called out in the spec.

**Configuration**:
```typescript
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'none'"],
      imgSrc: ["'none'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,       // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xContentTypeOptions: true,  // default true; explicit for documentation
  xXssProtection: false,      // disabled — CSP supersedes this header
})
```

**Note on Swagger UI**: The bare `helmet()` CSP will block the Swagger UI's inline scripts. The `/api/docs` route must mount swagger-ui-express **before** the global helmet middleware, or use a route-specific relaxed CSP only for that path.

**Solution**: Apply a permissive CSP only on the `/api/docs` path using a route-level `helmet()` override:
```typescript
app.use('/api/docs', helmet({ contentSecurityPolicy: false }));
app.use('/api/docs', swaggerUiRouter);
app.use(helmet({ /* strict config */ })); // global — all other routes
```

---

## D4 — OpenAPI Documentation: Library Choice

**Decision**: `swagger-jsdoc` + `swagger-ui-express`.

**Rationale**: Our existing routers are plain Express.js with no decorators. `swagger-jsdoc` reads `@openapi` JSDoc annotations from existing route files and merges them into a single OpenAPI 3.0 spec — zero structural refactoring needed. `swagger-ui-express` serves the resulting spec as an interactive Redoc/Swagger UI page.

**Alternative considered**:
- `tsoa` — generates both routes and OpenAPI from TypeScript decorators. Rejected because it requires restructuring all existing routers to use controller classes — a multi-day migration that is out of scope for a hardening phase.
- Handwritten `openapi.yaml` — rejected because it diverges from code over time and requires manual maintenance.
- `express-openapi-validator` — validates requests against a spec file; useful but orthogonal. Not included in this phase.

**Annotation format**: Each router file gets `@openapi` JSDoc blocks on route handlers. The `swagger.config.ts` tells `swagger-jsdoc` which files to scan (glob pattern).

**Serving**: `GET /api/docs` → Swagger UI HTML. `GET /api/docs/swagger.json` → raw JSON spec (useful for tooling). The endpoint is public (no auth).

---

## D5 — Integration Test Framework

**Decision**: Jest + Supertest + `ts-jest`.

**Rationale**: Jest is the dominant test runner in the Node.js/TypeScript ecosystem. `ts-jest` allows running TypeScript test files without a separate compile step. `supertest` wraps the Express `app` in an HTTP test client — no port binding needed, tests run in-process.

**Test database strategy**: A separate database pointed to by `TEST_DATABASE_URL`. The test helper (`tests/helpers/app.helper.ts`) runs `npm run db:migrate` against the test DB before the suite, seeds one test facility + user, and truncates tables after each test group using `TRUNCATE ... CASCADE` to reset state. This avoids the overhead of a full migrate + seed before every single test.

**Alternative considered**:
- Vitest — faster but slightly less ecosystem support for Supertest. Rejected in favour of Jest because the codebase already uses `jest`-compatible type assertions and the team is more familiar.
- Separate test schema (not separate DB) — `SET search_path = test_schema` approach. Rejected because Drizzle migrations target the default schema and schema switching adds complexity. Separate DB is simpler.

**Test file location**: `backend/tests/` (sibling to `src/` not nested inside it) — standard Jest convention; keeps test infrastructure separate from production source.

**CI integration**: Add a `test` script to `backend/package.json` that runs `jest --forceExit`. The `--forceExit` flag ensures the process terminates even if the database connection pool lingers.

---

## D6 — Body Size Limit (Status: Already Implemented)

**Decision**: No change needed. `app.ts` already sets:
```typescript
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```
Express returns 413 `PayloadTooLargeError` automatically when the limit is exceeded. The existing error handler falls through to the generic 500 handler for unrecognised error types — need to add an explicit 413 handler for `PayloadTooLargeError`.

**Fix**: In the global error handler, check `err instanceof SyntaxError && (err as NodeJS.ErrnoException).type === 'entity.too.large'` → respond 413.

---

## D7 — Production Error Response (Status: Already Partially Implemented)

**Decision**: The current error handler already responds generically in production. One gap: `AppError` responses always include `message` which may contain internal identifiers in future error codes. For now this is acceptable — `AppError` messages are developer-authored strings, not runtime data. No change needed.

**Verification**: In production mode (`NODE_ENV=production`), `console.error` is suppressed ✓. The 500 response body contains only `{ error: { code, message, requestId } }` ✓.

---

## D8 — `Retry-After` Header in Rate Limit Responses

**Decision**: Use `express-rate-limit` v7's `standardHeaders: 'draft-7'` option which emits `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (as seconds), and automatically includes `Retry-After` when a client is blocked.

**Alternative**: Custom `handler` callback setting `res.set('Retry-After', ...)` manually — unnecessary when the library handles it natively.

---

## Summary Table

| # | Area | Decision | Library/Approach |
|---|------|----------|-----------------|
| D1 | Rate limiting | Three named limiters, 1-min windows | `express-rate-limit` v7 |
| D2 | CORS | Single `ALLOWED_ORIGINS` env var, fail-fast in production | `cors` (existing) |
| D3 | Helmet | Explicit CSP/HSTS/frameguard; relaxed override for `/api/docs` | `helmet` (existing) |
| D4 | OpenAPI | JSDoc annotations + swagger-jsdoc + swagger-ui-express | `swagger-jsdoc` + `swagger-ui-express` |
| D5 | Tests | Jest + ts-jest + Supertest, isolated test database | `jest` + `supertest` |
| D6 | Body size | Already 1mb — add explicit 413 handler | No new dep |
| D7 | Error responses | Already production-safe — verify only | No change |
| D8 | Retry-After | Built into `express-rate-limit` draft-7 headers | `express-rate-limit` v7 |
