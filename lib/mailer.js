import nodemailer from "nodemailer";

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendMail = () => hasSmtpConfig();

export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured");
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
      text: `You requested a password reset.\n\nOpen this link to reset your password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    });
  } catch (error) {
    const message = error?.message || "Unable to send reset email";
    throw new Error(`Unable to send reset email: ${message}`);
  }
};

