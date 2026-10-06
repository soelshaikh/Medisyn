import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST ?? 'smtp.brevo.com',
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_PASSWORD ?? '',
  },
});

const from = `"${process.env.EMAIL_FROM_NAME ?? 'MediSyn'}" <${process.env.EMAIL_FROM ?? 'noreply@medisyn.ca'}>`;
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  facilityName: string,
): Promise<void> {
  const url = `${frontendUrl}/verify-email?token=${token}`;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Verify your email — ${facilityName}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Please verify your email address: ${url}`,
        '',
        'This link expires in 24 hours.',
        "If you didn't create an account, you can safely ignore this email.",
        '',
        `— The ${facilityName} Team`,
      ].join('\n'),
      html: `<p>Hi ${firstName},</p><p>Please <a href="${url}">verify your email address</a>. This link expires in 24 hours.</p><p>If you didn't create an account, you can safely ignore this email.</p><p>— The ${facilityName} Team</p>`,
    });
  } catch (err) {
    console.error('[email] sendVerificationEmail failed for', to, err);
  }
}

export async function sendPasswordResetEmail(
  to: string,
  firstName: string,
  token: string,
  facilityName: string,
): Promise<void> {
  const url = `${frontendUrl}/reset-password?token=${token}`;
  try {
    await transporter.sendMail({
      from,
      to,
      subject: `Reset your password — ${facilityName}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Reset your password (valid for 30 minutes): ${url}`,
        '',
        "If you didn't request this, you can safely ignore this email.",
        '',
        `— The ${facilityName} Team`,
      ].join('\n'),
      html: `<p>Hi ${firstName},</p><p>Click to <a href="${url}">reset your password</a>. This link expires in 30 minutes.</p><p>If you didn't request this, you can safely ignore this email.</p><p>— The ${facilityName} Team</p>`,
    });
  } catch (err) {
    console.error('[email] sendPasswordResetEmail failed for', to, err);
  }
}
