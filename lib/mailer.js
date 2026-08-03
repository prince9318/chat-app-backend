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
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
  });

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your password",
    text: `You requested a password reset.\n\nOpen this link to reset your password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
  });
};

