import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { bullmqRedis } from '@/lib/redis';
import { updateEmailLogStatus } from './email-log.service';
import { renderTemplate } from './template-loader';
import type { EmailJobPayload } from './email.queue';

// ── nodemailer transport ──────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST ?? 'smtp-relay.brevo.com',
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_PASSWORD ?? '',
  },
});

const FROM = `"${process.env.EMAIL_FROM_NAME ?? 'MediSyn'}" <${process.env.EMAIL_FROM ?? 'noreply@medisyn.ca'}>`;

// ── renderEmail ───────────────────────────────────────────────────────────

async function renderEmail(
  templateName: string,
  data: Record<string, unknown>,
): Promise<{ subject: string; html: string }> {
  const enriched = {
    ...data,
    frontendUrl: process.env.FRONTEND_URL ?? 'https://medisyn.ca',
    currentYear: new Date().getFullYear(),
  };
  return renderTemplate(templateName, enriched);
}

// ── Job processor ─────────────────────────────────────────────────────────

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { to, templateName, templateData, logId } = job.data;
  const startMs = Date.now();

  let subject: string;
  let html: string;

  try {
    ({ subject, html } = await renderEmail(templateName, templateData));
  } catch (renderErr: unknown) {
    const msg = renderErr instanceof Error ? renderErr.message : String(renderErr);
    await updateEmailLogStatus(logId, {
      status: 'failed',
      errorMessage: `Template render failed: ${msg}`.slice(0, 2000),
      attemptCount: job.attemptsMade + 1,
    });
    // Re-throw so BullMQ marks the job as failed and can retry
    throw renderErr;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });

    await updateEmailLogStatus(logId, {
      status: 'sent',
      sentAt: new Date(),
      durationMs: Date.now() - startMs,
      attemptCount: job.attemptsMade + 1,
    });
  } catch (sendErr: unknown) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    await updateEmailLogStatus(logId, {
      status: job.attemptsMade + 1 >= (job.opts?.attempts ?? 3) ? 'failed' : 'queued',
      errorMessage: msg.slice(0, 2000),
      attemptCount: job.attemptsMade + 1,
    });
    throw sendErr;
  }
}

// ── Worker export ─────────────────────────────────────────────────────────

export const emailWorker = new Worker<EmailJobPayload>(
  'email',
  processEmailJob,
  {
    connection: bullmqRedis,
    concurrency: 5,
  },
);

emailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[email-worker] job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  }
});

emailWorker.on('completed', (job) => {
  console.log(`[email-worker] job ${job.id} completed (${job.data.templateName} → ${job.data.to})`);
});
