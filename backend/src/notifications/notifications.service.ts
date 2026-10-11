import { eq, and, desc, count, lte, SQL } from 'drizzle-orm';
import { workerDb } from '@/db';
import { redis } from '@/lib/redis';
import { notifications, NewNotification, Notification } from '@/db/schema/async-infra';
import type { TenantTransaction } from '@/db';

// ── Redis cache key ───────────────────────────────────────────────────────────
// notifications:unread:{userId}:{facilityId}  →  integer string, TTL 10 min

const UNREAD_TTL_SECONDS = 600;

function unreadKey(userId: string, facilityId: string): string {
  return `notifications:unread:${userId}:${facilityId}`;
}

// ── createNotification ────────────────────────────────────────────────────────
// Insert a notification inside an existing withTenantContext transaction.
// Callers pass tx from their own transaction so the notification rolls back
// if the parent operation fails (no phantom notifications).

export async function createNotification(
  tx: TenantTransaction,
  data: Pick<NewNotification, 'facilityId' | 'userId' | 'type' | 'title' | 'body' | 'actionUrl'>,
): Promise<void> {
  await tx.insert(notifications).values({ ...data, isRead: false, isDeleted: false });
  // Increment unread counter in Redis (best-effort — DB is source of truth)
  try {
    const key = unreadKey(data.userId, data.facilityId);
    await redis.incr(key);
    await redis.expire(key, UNREAD_TTL_SECONDS);
  } catch {
    // Redis unavailable — unread count will be derived from DB on next read
  }
}

// ── broadcastNotifications ────────────────────────────────────────────────────
// Admin broadcast: fan-out to one or many users in a facility.
// Uses workerDb (BYPASSRLS) since super-admin callers may not have a facility context.

export async function broadcastNotifications(
  facilityId: string,
  userIds: string[],
  data: Pick<NewNotification, 'type' | 'title' | 'body' | 'actionUrl'>,
): Promise<number> {
  if (userIds.length === 0) return 0;

  const rows: NewNotification[] = userIds.map((userId) => ({
    facilityId,
    userId,
    type: data.type,
    title: data.title,
    body: data.body,
    actionUrl: data.actionUrl,
    isRead: false,
    isDeleted: false,
  }));

  // Insert in chunks of 200 to avoid excessive parameter counts
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await workerDb.insert(notifications).values(chunk);
    inserted += chunk.length;
  }

  // Invalidate unread cache for each user (best-effort)
  try {
    if (userIds.length <= 50) {
      await Promise.all(
        userIds.map((uid) => redis.del(unreadKey(uid, facilityId))),
      );
    }
  } catch {
    // ignore
  }

  return inserted;
}

// ── getUnreadCount ────────────────────────────────────────────────────────────
// Redis-backed unread count with DB fallback on cache miss.

export async function getUnreadCount(userId: string, facilityId: string): Promise<number> {
  try {
    const cached = await redis.get(unreadKey(userId, facilityId));
    if (cached !== null) return parseInt(cached, 10);
  } catch {
    // Redis unavailable — fall through to DB
  }

  const count = await getUnreadCountFromDb(userId, facilityId);

  // Backfill cache
  try {
    await redis.set(unreadKey(userId, facilityId), String(count), 'EX', UNREAD_TTL_SECONDS);
  } catch {
    // ignore
  }

  return count;
}

async function getUnreadCountFromDb(userId: string, facilityId: string): Promise<number> {
  const [row] = await workerDb
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.facilityId, facilityId),
        eq(notifications.isRead, false),
        eq(notifications.isDeleted, false),
      ),
    );
  return Number(row?.total ?? 0);
}

// ── listNotifications ─────────────────────────────────────────────────────────

export interface ListNotificationsOptions {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export interface NotificationsListResult {
  items: Notification[];
  total: number;
  unreadCount: number;
}

export async function listNotifications(
  userId: string,
  facilityId: string,
  opts: ListNotificationsOptions,
): Promise<NotificationsListResult> {
  const conditions: SQL[] = [
    eq(notifications.userId, userId),
    eq(notifications.facilityId, facilityId),
    eq(notifications.isDeleted, false),
  ];

  if (opts.unreadOnly) conditions.push(eq(notifications.isRead, false));

  const where = conditions.length > 1
    ? and(...conditions)
    : conditions[0];

  const offset = (opts.page - 1) * opts.limit;

  const [items, [{ total }], unreadCount] = await Promise.all([
    workerDb
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(opts.limit)
      .offset(offset),
    workerDb.select({ total: count() }).from(notifications).where(where),
    getUnreadCount(userId, facilityId),
  ]);

  return { items, total: Number(total), unreadCount };
}

// ── markRead ──────────────────────────────────────────────────────────────────

export async function markNotificationRead(
  notificationId: string,
  userId: string,
  facilityId: string,
): Promise<void> {
  const now = new Date();
  const [updated] = await workerDb
    .update(notifications)
    .set({ isRead: true, readAt: now })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        eq(notifications.facilityId, facilityId),
        eq(notifications.isRead, false),
      ),
    )
    .returning({ id: notifications.id });

  if (updated) {
    // Decrement Redis counter; don't let it go below 0
    try {
      const key = unreadKey(userId, facilityId);
      const val = await redis.decr(key);
      if (val < 0) await redis.set(key, '0');
    } catch {
      // ignore
    }
  }
}

export async function markAllNotificationsRead(
  userId: string,
  facilityId: string,
): Promise<void> {
  await workerDb
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.facilityId, facilityId),
        eq(notifications.isRead, false),
        eq(notifications.isDeleted, false),
      ),
    );

  try {
    await redis.set(unreadKey(userId, facilityId), '0', 'EX', UNREAD_TTL_SECONDS);
  } catch {
    // ignore
  }
}

// ── softDeleteNotification ────────────────────────────────────────────────────

export async function softDeleteNotification(
  notificationId: string,
  userId: string,
  facilityId: string,
): Promise<boolean> {
  const [deleted] = await workerDb
    .update(notifications)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        eq(notifications.facilityId, facilityId),
        eq(notifications.isDeleted, false),
      ),
    )
    .returning({ id: notifications.id });

  return !!deleted;
}

// ── pruneOldNotifications ─────────────────────────────────────────────────────
// Called by the repeatable BullMQ cron job (T042) — deletes soft-deleted rows
// older than 90 days. Uses workerDb to avoid RLS restrictions.

export async function pruneOldNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const deleted = await workerDb
    .delete(notifications)
    .where(
      and(
        eq(notifications.isDeleted, true),
        lte(notifications.deletedAt, cutoff),
      ),
    )
    .returning({ id: notifications.id });
  return deleted.length;
}
