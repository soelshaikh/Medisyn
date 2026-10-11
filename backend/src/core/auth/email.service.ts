import { enqueueEmail } from '@/email/email.queue';

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  facilityName: string,
): Promise<void> {
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
  await enqueueEmail({
    to,
    templateName: 'verify-email',
    templateData: { firstName, verifyUrl, facilityName },
    idempotencyKey: `verify-email:${to}:${token}`,
    facilityId: null,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string,
  facilityName: string,
): Promise<void> {
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  await enqueueEmail({
    to,
    templateName: 'forgot-password',
    templateData: { firstName, resetUrl, facilityName },
    idempotencyKey: `forgot-password:${to}:${token}`,
    facilityId: null,
  });
}
