import nodemailer from "nodemailer";
import { config } from "@/config";
import { logger } from "@/common/utils/logger";

interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
}

/** Brevo HTTP API — port 443, never blocked by cloud platforms */
export async function sendViaBrevoApi(opts: SendEmailOptions) {
  const body = JSON.stringify({
    sender:      { name: config.EMAIL_FROM_NAME, email: config.EMAIL_FROM },
    to:          [{ email: opts.to }],
    subject:     opts.subject,
    htmlContent: opts.html,
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:  "POST",
    headers: {
      accept:           "application/json",
      "api-key":        config.BREVO_API_KEY!,
      "content-type":   "application/json",
    },
    body,
  });

  const data = (await response.json()) as { messageId?: string };
  if (!response.ok) throw new Error(`Brevo API error ${response.status}: ${JSON.stringify(data)}`);

  logger.info(`[EMAIL] Brevo API sent. MessageId: ${data.messageId}`);
  return { messageId: data.messageId ?? "brevo-ok" };
}

/** SMTP transport — Resend → SendGrid → custom SMTP */
export function createSmtpTransport() {
  if (config.RESEND_API_KEY) {
    logger.info("[EMAIL] Using Resend SMTP");
    return nodemailer.createTransport({
      host: "smtp.resend.com", port: 465, secure: true,
      auth: { user: "resend", pass: config.RESEND_API_KEY },
    });
  }
  if (config.SENDGRID_API_KEY) {
    logger.info("[EMAIL] Using SendGrid SMTP");
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net", port: 587, secure: false,
      auth: { user: "apikey", pass: config.SENDGRID_API_KEY },
    });
  }
  logger.info("[EMAIL] Using custom SMTP");
  return nodemailer.createTransport({
    host:   config.EMAIL_HOST,
    port:   Number(config.EMAIL_PORT ?? 587),
    secure: Number(config.EMAIL_PORT) === 465,
    auth:   { user: config.EMAIL_USER, pass: config.EMAIL_PASSWORD },
  });
}
