import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { bullmqRedis } from '@/lib/redis';
import { workerDb } from '@/db';
import { emailLog } from '@/db/schema/async-infra';

// ── Job payload ───────────────────────────────────────────────────────────

export interface EmailJobPayload {
  to: string;
  templateName: string;
  templateData: Record<string, unknown>;
  idempotencyKey: string;
  facilityId: string | null;
  logId: string;
}

// ── Queue ─────────────────────────────────────────────────────────────────

export const emailQueue = new Queue<EmailJobPayload>('email', {
  connection: bullmqRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: false,
  },
});

// ── Sync transport — fallback when Redis is unavailable ───────────────────

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST ?? 'smtp-relay.brevo.com',
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_PASSWORD ?? '',
  },
});

// ── enqueueEmail ──────────────────────────────────────────────────────────
// Creates an email_log record, then enqueues a BullMQ job.
// Falls back to synchronous nodemailer send if Redis is unavailable so no
// email is ever silently dropped (research Decision 7; constitution §III).

export async function enqueueEmail(
  payload: Omit<EmailJobPayload, 'logId'>,
): Promise<void> {
  // 1. Insert email_log row (persists regardless of Redis state).
  const [logRow] = await workerDb
    .insert(emailLog)
    .values({
      facilityId: payload.facilityId,
      idempotencyKey: payload.idempotencyKey,
      recipient: payload.to,
      templateName: payload.templateName,
      status: 'queued',
      enqueuedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: emailLog.id });

  if (!logRow) {
    // Idempotency key already exists — already enqueued; skip silently.
    return;
  }

  const logId = logRow.id;
  const fullPayload: EmailJobPayload = { ...payload, logId };

  // 2. Try to enqueue via BullMQ.
  try {
    await emailQueue.add('send', fullPayload, {
      jobId: payload.idempotencyKey,
    });
    await workerDb
      .update(emailLog)
      .set({ jobId: payload.idempotencyKey, updatedAt: new Date() })
      .where(eq(emailLog.id, logId));
  } catch (redisErr: unknown) {
    const isConnErr =
      redisErr instanceof Error &&
      (redisErr.message.includes('ECONNREFUSED') ||
        redisErr.message.includes('connect ETIMEDOUT') ||
        redisErr.message.includes('Redis'));

    if (!isConnErr) throw redisErr;

    // Redis unavailable — synchronous fallback (pre-Phase-7 behaviour).
    console.warn('[email] Redis unavailable — falling back to synchronous send for', payload.to);
    const startMs = Date.now();
    try {
      await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME ?? 'MediSyn'}" <${process.env.EMAIL_FROM ?? 'noreply@medisyn.ca'}>`,
        to: payload.to,
        subject: `[${payload.templateName}]`,
        text: `${payload.templateName} — ${JSON.stringify(payload.templateData)}`,
      });
      await workerDb
        .update(emailLog)
        .set({
          status: 'sent',
          attemptCount: 1,
          sentAt: new Date(),
          durationMs: Date.now() - startMs,
          updatedAt: new Date(),
        })
        .where(eq(emailLog.id, logId));
    } catch (sendErr: unknown) {
      await workerDb
        .update(emailLog)
        .set({
          status: 'failed',
          attemptCount: 1,
          errorMessage:
            sendErr instanceof Error ? sendErr.message.slice(0, 2000) : String(sendErr).slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(emailLog.id, logId));
    }
  }
}
