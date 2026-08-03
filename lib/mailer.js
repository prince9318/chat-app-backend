import nodemailer from "nodemailer";

const hasResendConfig = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendMail = () => hasResendConfig() || hasSmtpConfig();

const buildResetEmailText = (resetUrl) =>
  `You requested a password reset.\n\nOpen this link to reset your password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;

const sendViaResend = async ({ to, resetUrl }) => {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is unavailable in this Node.js runtime");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: "Reset your password",
      text: buildResetEmailText(resetUrl),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Resend API error (${response.status}): ${errorText || "Unable to send email"}`
    );
  }
};

export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  if (hasResendConfig()) {
    await sendViaResend({ to, resetUrl });
    return;
  }

  if (!hasSmtpConfig()) {
    throw new Error("No email provider is configured");
  }

  const smtpPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
    dnsTimeout: Number(process.env.SMTP_DNS_TIMEOUT || 10000),
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
  });

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: "Reset your password",
      text: buildResetEmailText(resetUrl),
    });
  } catch (error) {
    const message = error?.message || "Unable to send reset email";
    throw new Error(`Unable to send reset email: ${message}`);
  }
};

