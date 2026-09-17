import { config } from "@/config";
import { logger } from "@/common/utils/logger";
import { EmailLogModel } from "./email-log.schema";
import { emailTemplates } from "./email.templates";
import { sendViaBrevoApi, createSmtpTransport } from "./email.config";

interface SendOptions {
  to:       string;
  subject:  string;
  html:     string;
  type:     string;
  metadata?: Record<string, unknown>;
}

export class EmailService {
  static async send(opts: SendOptions): Promise<{ messageId: string }> {
    const { to, subject, html, type, metadata = {} } = opts;

    const hasBrevo    = Boolean(config.BREVO_API_KEY);
    const hasResend   = Boolean(config.RESEND_API_KEY);
    const hasSendGrid = Boolean(config.SENDGRID_API_KEY);
    const hasSmtp     = Boolean(config.EMAIL_HOST && config.EMAIL_USER && config.EMAIL_PASSWORD);

    if (!hasBrevo && !hasResend && !hasSendGrid && !hasSmtp) {
      logger.warn(`[EMAIL] No provider configured. Skipping email to ${to} (${type})`);
      logger.info(`[EMAIL PREVIEW] Subject: ${subject}`);
      await EmailLogModel.create({ to, subject, type, status: "skipped", messageId: "no-provider", metadata });
      return { messageId: "no-provider" };
    }

    try {
      let result: { messageId: string };

      if (hasBrevo) {
        result = await sendViaBrevoApi({ to, subject, html });
      } else {
        const transporter = createSmtpTransport();
        const info = await transporter.sendMail({
          from: `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`,
          to, subject, html,
        });
        result = { messageId: info.messageId as string };
      }

      await EmailLogModel.create({ to, subject, type, status: "sent", messageId: result.messageId, metadata });
      return result;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[EMAIL] Failed to send to ${to} (${type}): ${msg}`);
      await EmailLogModel.create({ to, subject, type, status: "failed", messageId: "", error: msg, metadata }).catch(() => null);

      if (config.NODE_ENV !== "production") {
        logger.warn("[EMAIL] Continuing without email in non-production mode");
        return { messageId: "email-failed-dev" };
      }
      throw error;
    }
  }

  /* ── Typed helpers ── */

  static async sendVerificationEmail(user: { _id: unknown; email: string; fullName: string }, token: string) {
    const url = `${config.FRONTEND_URL}/verify-email?token=${token}`;
    const { subject, html } = emailTemplates.verifyEmail(user.fullName, url);
    await this.send({ to: user.email, subject, html, type: "verify_email", metadata: { userId: String(user._id) } });
  }

  static async sendPasswordResetEmail(user: { _id: unknown; email: string; fullName: string }, token: string) {
    const url = `${config.FRONTEND_URL}/reset-password?token=${token}`;
    const { subject, html } = emailTemplates.resetPassword(user.fullName, url);
    await this.send({ to: user.email, subject, html, type: "password_reset", metadata: { userId: String(user._id) } });
  }

  static async sendWelcomeEmail(user: { _id: unknown; email: string; fullName: string }) {
    const { subject, html } = emailTemplates.welcome(user.fullName);
    await this.send({ to: user.email, subject, html, type: "welcome", metadata: { userId: String(user._id) } });
  }

  static async sendPrescriptionReceivedEmail(user: { email: string; fullName: string }, refNumber: string) {
    const { subject, html } = emailTemplates.prescriptionReceived(user.fullName, refNumber);
    await this.send({ to: user.email, subject, html, type: "prescription_received", metadata: { refNumber } });
  }

  static async sendOrderConfirmedEmail(user: { email: string; fullName: string }, orderId: string, total: string) {
    const { subject, html } = emailTemplates.orderConfirmed(user.fullName, orderId, total);
    await this.send({ to: user.email, subject, html, type: "order_confirmed", metadata: { orderId } });
  }

  static async sendAppointmentConfirmedEmail(user: { email: string; fullName: string }, service: string, dateTime: string) {
    const { subject, html } = emailTemplates.appointmentConfirmed(user.fullName, service, dateTime);
    await this.send({ to: user.email, subject, html, type: "appointment_confirmed", metadata: { service, dateTime } });
  }

  static async sendAppointmentReminderEmail(user: { email: string; fullName: string }, service: string, dateTime: string) {
    const { subject, html } = emailTemplates.appointmentReminder(user.fullName, service, dateTime);
    await this.send({ to: user.email, subject, html, type: "appointment_reminder", metadata: { service, dateTime } });
  }

  static async sendAccountSuspendedEmail(user: { _id: unknown; email: string; fullName: string }, reason?: string) {
    const { subject, html } = emailTemplates.accountSuspended(user.fullName, reason);
    await this.send({ to: user.email, subject, html, type: "account_suspended", metadata: { userId: String(user._id), reason } });
  }
}
