const base = (content: string) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1A202C;">
  <div style="background:#1677A8;padding:24px 32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">MediSyn</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">Compounding Pharmacy</p>
  </div>
  <div style="padding:32px;">
    ${content}
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />
    <p style="color:#718096;font-size:12px;margin:0;">
      MediSyn Compounding Pharmacy — If you did not request this email, please ignore it.
    </p>
  </div>
</div>`;

const btn = (url: string, label: string, color = "#1677A8") =>
  `<a href="${url}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${label}</a>`;

export const emailTemplates = {
  verifyEmail: (name: string, url: string) => ({
    subject: "Verify your MediSyn email address",
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Welcome to MediSyn, ${name}!</h2>
      <p>Thank you for creating your account. Please verify your email address to activate your account.</p>
      ${btn(url, "Verify Email")}
      <p style="color:#718096;font-size:13px;">This link expires in 24 hours.<br>
      If the button doesn't work, copy this link: <br><a href="${url}" style="color:#1677A8;">${url}</a></p>
    `),
  }),

  resetPassword: (name: string, url: string) => ({
    subject: "Reset your MediSyn password",
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Password Reset</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your MediSyn password. Click below to set a new one:</p>
      ${btn(url, "Reset Password")}
      <p style="color:#718096;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email — your password won't change.</p>
    `),
  }),

  welcome: (name: string) => ({
    subject: "Welcome to MediSyn!",
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Welcome, ${name}!</h2>
      <p>Your MediSyn account is now active. You can now:</p>
      <ul style="line-height:1.9;">
        <li>Order compounded medications</li>
        <li>Submit prescriptions</li>
        <li>Book appointments and vaccine clinics</li>
        <li>Ask our pharmacists questions</li>
      </ul>
      <p>If you have any questions, our pharmacist team is here to help.</p>
    `),
  }),

  prescriptionReceived: (name: string, refNumber: string) => ({
    subject: `Prescription received — Ref #${refNumber}`,
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Prescription Received</h2>
      <p>Hi ${name},</p>
      <p>We have received your prescription. Our pharmacist will review it and follow up with you shortly.</p>
      <div style="background:#F0F9FF;border-left:4px solid #1677A8;padding:16px;margin:20px 0;border-radius:4px;">
        <strong>Reference Number:</strong> ${refNumber}
      </div>
      <p>Please have this number ready when contacting us about this prescription.</p>
    `),
  }),

  orderConfirmed: (name: string, orderId: string, total: string) => ({
    subject: `Order confirmed — #${orderId}`,
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Order Confirmed</h2>
      <p>Hi ${name},</p>
      <p>Your MediSyn order has been confirmed.</p>
      <div style="background:#F7F9FB;padding:16px;border-radius:6px;margin:20px 0;">
        <p style="margin:4px 0;"><strong>Order ID:</strong> #${orderId}</p>
        <p style="margin:4px 0;"><strong>Total:</strong> ${total}</p>
      </div>
      <p>We'll send you another email when your order is ready for pickup or ships.</p>
    `),
  }),

  appointmentConfirmed: (name: string, service: string, dateTime: string) => ({
    subject: `Appointment confirmed — ${service}`,
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Appointment Confirmed</h2>
      <p>Hi ${name},</p>
      <p>Your appointment has been confirmed:</p>
      <div style="background:#F7F9FB;padding:16px;border-radius:6px;margin:20px 0;">
        <p style="margin:4px 0;"><strong>Service:</strong> ${service}</p>
        <p style="margin:4px 0;"><strong>Date & Time:</strong> ${dateTime}</p>
      </div>
      <p>Please arrive 5 minutes early. To cancel or reschedule, contact us at least 24 hours in advance.</p>
    `),
  }),

  appointmentReminder: (name: string, service: string, dateTime: string) => ({
    subject: `Reminder: ${service} appointment tomorrow`,
    html: base(`
      <h2 style="color:#1677A8;margin-top:0;">Appointment Reminder</h2>
      <p>Hi ${name},</p>
      <p>This is a reminder for your upcoming appointment:</p>
      <div style="background:#FFF8E1;border-left:4px solid #F2C14E;padding:16px;margin:20px 0;border-radius:4px;">
        <p style="margin:4px 0;"><strong>Service:</strong> ${service}</p>
        <p style="margin:4px 0;"><strong>Date & Time:</strong> ${dateTime}</p>
      </div>
    `),
  }),

  accountSuspended: (name: string, reason?: string) => ({
    subject: "Your MediSyn account has been suspended",
    html: base(`
      <h2 style="color:#E53E3E;margin-top:0;">Account Suspended</h2>
      <p>Hi ${name},</p>
      <p>Your MediSyn account has been suspended.</p>
      ${reason ? `<div style="background:#FFF5F5;border-left:4px solid #E53E3E;padding:16px;margin:20px 0;border-radius:4px;"><strong>Reason:</strong> ${reason}</div>` : ""}
      <p>If you believe this is an error, please contact our support team.</p>
    `),
  }),
};
