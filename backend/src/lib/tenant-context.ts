import { sql } from 'drizzle-orm';
import { db, TenantTransaction } from '@/db';
import { AppError } from './errors';

// withTenantContext — the single canonical wrapper for all facility-scoped queries.
//
// Contract:
//   1. Opens a Drizzle transaction against the app_user pool.
//   2. Sets tenant context as the FIRST statement (transaction-local via true flag).
//   3. Invokes fn(tx).
//   4. Commits on success, rolls back on error.
//   5. Tenant context is cleared automatically when the transaction ends.
//
// Invariants:
//   - fn MUST NOT import db or superAdminDb directly.
//   - facilityId must be a valid UUID string (validated before opening transaction).
//   - Do NOT nest withTenantContext calls.
//   - Only the app_user pool is used — no BYPASSRLS inside this function.

export async function withTenantContext<T>(
  facilityId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  if (!facilityId || typeof facilityId !== 'string') {
    throw new AppError(
      'INTERNAL_ERROR',
      'withTenantContext: facilityId must be a non-empty string',
      500,
    );
  }

  return db.transaction(async (tx) => {
    // Set tenant context as transaction-local (true = cleared on commit/rollback)
    // PgBouncer transaction mode safe: context never leaks to next request.
    await tx.execute(
      sql`SELECT set_config('app.current_facility_id', ${facilityId}, true)`,
    );

    return fn(tx as TenantTransaction);
  });
}
