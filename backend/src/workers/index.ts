import { Queue, Worker } from 'bullmq';
import { bullmqRedis } from '@/lib/redis';
import { workerDb } from '@/db';
import { sql } from 'drizzle-orm';
import { emailWorker } from '@/email/email.worker';
import { enqueueEmail } from '@/email/email.queue';
import { pruneOldNotifications } from '@/notifications/notifications.service';

// ── Appointment reminder ──────────────────────────────────────────────────────
// Runs every hour. Scans for appointments starting in [now+24h, now+25h] and
// enqueues reminder emails. jobId deduplication prevents double-sends.

const appointmentReminderQueue = new Queue('appointment-reminders', {
  connection: bullmqRedis,
  defaultJobOptions: { removeOnComplete: { count: 10 }, removeOnFail: false },
});

const appointmentReminderWorker = new Worker(
  'appointment-reminders',
  async () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Find appointments starting in the 24–25h window with status = scheduled
    const rows = await workerDb.execute<{
      id: string;
      patientId: string;
      patientEmail: string;
      patientFirstName: string;
      serviceName: string;
      slotDate: string;
      startTime: string;
      facilityId: string;
    }>(sql`
      SELECT
        a.id,
        a.patient_id          AS "patientId",
        u.email               AS "patientEmail",
        u.first_name          AS "patientFirstName",
        vs.name               AS "serviceName",
        avs.slot_date         AS "slotDate",
        avs.start_time        AS "startTime",
        a.facility_id         AS "facilityId"
      FROM appointments a
      JOIN availability_slots avs ON avs.id = a.slot_id
      JOIN vaccine_services   vs  ON vs.id  = a.service_id
      JOIN users              u   ON u.id   = a.patient_id
      WHERE a.status = 'scheduled'
        AND (avs.slot_date || 'T' || avs.start_time)::timestamptz >= ${windowStart.toISOString()}
        AND (avs.slot_date || 'T' || avs.start_time)::timestamptz <  ${windowEnd.toISOString()}
    `);

    for (const row of rows) {
      await enqueueEmail({
        to: row.patientEmail,
        templateName: 'appointment-reminder',
        templateData: {
          firstName:       row.patientFirstName,
          serviceName:     row.serviceName,
          appointmentDate: `${row.slotDate} at ${row.startTime}`,
          location:        'Your pharmacy',
          appointmentUrl:  `${process.env.FRONTEND_URL ?? ''}/patient/appointments/${row.id}`,
        },
        idempotencyKey: `reminder-${row.id}`,
        facilityId:     row.facilityId,
      });
    }

    console.log(`[reminder-worker] scanned window ${windowStart.toISOString()} — ${windowEnd.toISOString()}: ${rows.length} reminders queued`);
  },
  { connection: bullmqRedis, concurrency: 1 },
);

appointmentReminderWorker.on('failed', (_job, err) => {
  console.error('[reminder-worker] scan failed:', err.message);
});

// ── Notification prune ────────────────────────────────────────────────────────
// Runs once daily. Deletes soft-deleted notification rows older than 90 days.

const notificationPruneQueue = new Queue('notification-prune', {
  connection: bullmqRedis,
  defaultJobOptions: { removeOnComplete: { count: 5 }, removeOnFail: false },
});

const notificationPruneWorker = new Worker(
  'notification-prune',
  async () => {
    const deleted = await pruneOldNotifications();
    console.log(`[prune-worker] deleted ${deleted} stale notification rows`);
  },
  { connection: bullmqRedis, concurrency: 1 },
);

notificationPruneWorker.on('failed', (_job, err) => {
  console.error('[prune-worker] prune failed:', err.message);
});

// ── startWorkers ──────────────────────────────────────────────────────────────
// Initialises all BullMQ workers and registers repeatable cron jobs.
// Called from src/index.ts after the HTTP server starts listening.

export async function startWorkers(): Promise<void> {
  // Email worker — processes async email send jobs
  if (!emailWorker.isRunning()) {
    console.log('[worker] email worker ready — listening on queue \'email\'');
  }

  // Appointment reminder — hourly scan
  await appointmentReminderQueue.add(
    'scan',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'appointment-reminder-scan',
    },
  );
  console.log('[worker] appointment-reminder scan registered (hourly)');

  // Notification prune — daily at 03:00 UTC
  await notificationPruneQueue.add(
    'prune',
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'notification-prune-daily',
    },
  );
  console.log('[worker] notification-prune registered (daily 03:00 UTC)');
}
