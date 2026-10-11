import { eq, and, desc, ilike, gte, lte, count, SQL } from 'drizzle-orm';
import { workerDb } from '@/db';
import { emailLog, EmailLog } from '@/db/schema/async-infra';

// ── Types ─────────────────────────────────────────────────────────────────

export interface EmailLogFilters {
  status?: string;
  recipient?: string;
  template?: string;
  from?: Date;
  to?: Date;
}

export interface EmailLogPagination {
  page: number;
  limit: number;
}

export interface EmailLogListResult {
  items: EmailLog[];
  total: number;
}

export interface EmailLogStatusUpdate {
  status?: string;
  errorMessage?: string | null;
  sentAt?: Date | null;
  durationMs?: number | null;
  attemptCount?: number;
  jobId?: string | null;
}

// ── createEmailLogEntry ───────────────────────────────────────────────────
// Used by enqueueEmail — workerDb bypasses RLS so system emails (null facilityId) work.

export async function createEmailLogEntry(data: {
  facilityId: string | null;
  idempotencyKey: string;
  recipient: string;
  templateName: string;
}): Promise<string> {
  const [row] = await workerDb
    .insert(emailLog)
    .values({
      ...data,
      status: 'queued',
      enqueuedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: emailLog.id });

  return row?.id ?? '';
}

// ── updateEmailLogStatus ──────────────────────────────────────────────────
// Called by the worker after each send attempt.

export async function updateEmailLogStatus(
  logId: string,
  update: EmailLogStatusUpdate,
): Promise<void> {
  await workerDb
    .update(emailLog)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(emailLog.id, logId));
}

// ── listEmailLog ──────────────────────────────────────────────────────────
// Admin-facing list with filters + pagination.
// Uses workerDb (BYPASSRLS) since it may return null-facility rows for super admin.
// Route layer enforces facilityId scoping via auth context.

export async function listEmailLog(
  facilityId: string,
  filters: EmailLogFilters,
  pagination: EmailLogPagination,
): Promise<EmailLogListResult> {
  const conditions: SQL[] = [eq(emailLog.facilityId, facilityId)];

  if (filters.status) conditions.push(eq(emailLog.status, filters.status));
  if (filters.recipient) conditions.push(ilike(emailLog.recipient, `%${filters.recipient}%`));
  if (filters.template) conditions.push(eq(emailLog.templateName, filters.template));
  if (filters.from) conditions.push(gte(emailLog.createdAt, filters.from));
  if (filters.to) conditions.push(lte(emailLog.createdAt, filters.to));

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const offset = (pagination.page - 1) * pagination.limit;

  const [items, [{ total }]] = await Promise.all([
    workerDb
      .select()
      .from(emailLog)
      .where(where)
      .orderBy(desc(emailLog.createdAt))
      .limit(pagination.limit)
      .offset(offset),
    workerDb
      .select({ total: count() })
      .from(emailLog)
      .where(where),
  ]);

  return { items, total: Number(total) };
}

// ── findEmailLogById ──────────────────────────────────────────────────────

export async function findEmailLogById(
  facilityId: string,
  id: string,
): Promise<EmailLog | undefined> {
  const [row] = await workerDb
    .select()
    .from(emailLog)
    .where(and(eq(emailLog.id, id), eq(emailLog.facilityId, facilityId)))
    .limit(1);
  return row;
}
