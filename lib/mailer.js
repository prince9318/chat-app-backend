import nodemailer from "nodemailer";

const hasResendConfig = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export const canSendMail = () => hasResendConfig() || hasSmtpConfig();
export const getMailProvider = () => {
  if (hasResendConfig()) return "resend";
  if (hasSmtpConfig()) return "smtp";
  return "none";
};

const buildResetEmailText = (resetUrl) =>
  `You requested a password reset.\n\nOpen this link to reset your password:\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`;

const buildVerificationEmailText = ({ fullName, otp, verifyUrl }) => {
  const parts = [];
  if (fullName) parts.push(`Hi ${fullName},`);
  else parts.push("Hi there,");
  parts.push("");
  parts.push("Welcome! Please verify your email address to get started.");
  parts.push("");
  if (otp) {
    parts.push(`Your verification code: ${otp}`);
    parts.push("");
  }
  if (verifyUrl) {
    parts.push("Or, click this link to verify your email:");
    parts.push(verifyUrl);
    parts.push("");
  }
  parts.push("This code/link expires in 15 minutes.");
  parts.push("");
  parts.push("If you didn't create an account, you can safely ignore this email.");
  return parts.join("\n");
};

const sendGenericViaResend = async ({ to, subject, text }) => {
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
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Resend API error (${response.status}): ${errorText || "Unable to send email"}`
    );
    error.mailProvider = "resend";
    error.httpStatus = response.status;
    throw error;
  }
};

const buildSmtpTransporter = () => {
  const smtpPass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const isSecure =
    String(process.env.SMTP_SECURE || "false") === "true" || port === 465;
  const requireTls =
    String(process.env.SMTP_REQUIRE_TLS || "true") === "true" && port !== 465;

  const tlsDefaults = {
    rejectUnauthorized:
      String(process.env.SMTP_REJECT_UNAUTHORIZED || "true") === "true",
  };

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTls,
    tls: tlsDefaults,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
    dnsTimeout: Number(process.env.SMTP_DNS_TIMEOUT || 10000),
    pool: String(process.env.SMTP_POOL || "false") === "true",
    maxConnections: 1,
    auth: {
      type: process.env.SMTP_AUTH_TYPE || "login",
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
    ...(process.env.SMTP_SERVICE
      ? { service: process.env.SMTP_SERVICE }
      : {}),
  });
};

let smtpVerified = false;
let smtpVerifyError = null;
const verifySmtpOnce = async (transporter) => {
  if (smtpVerified || smtpVerifyError) return;
  try {
    await transporter.verify();
    smtpVerified = true;
  } catch (err) {
    smtpVerifyError = err;
    console.warn(
      "[mailer] SMTP server verification failed. Will still attempt send, but delivery may fail.",
      {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        message: err?.message,
        code: err?.code,
        response: err?.response,
      }
    );
  }
};

const sendGenericViaSmtp = async ({ to, subject, text }) => {
  const transporter = buildSmtpTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const replyTo = process.env.MAIL_REPLY_TO || from;

  await verifySmtpOnce(transporter);

  try {
    const result = await transporter.sendMail({
      from,
      replyTo,
      to,
      subject,
      text,
      priority: "high",
      headers: {
        "X-Mailer": "chat-app",
      },
    });

    if (!result || !result.accepted || result.accepted.length === 0) {
      const err = new Error(
        `SMTP server did not accept the message. rejected=${JSON.stringify(
          result?.rejected || []
        )} response=${result?.response || ""}`
      );
      err.mailProvider = "smtp";
      err.smtpCode = result?.responseCode;
      err.smtpResponse = result?.response;
      throw err;
    }

    console.log("[mailer] SMTP email accepted by server", {
      to,
      messageId: result?.messageId,
      accepted: result?.accepted,
      response: result?.response,
    });
  } catch (error) {
    if (error?.mailProvider) throw error;
    const message = error?.message || "Unable to send email";
    const wrappedError = new Error(`Unable to send email: ${message}`);
    wrappedError.mailProvider = "smtp";
    wrappedError.smtpCode = error?.code;
    wrappedError.smtpCommand = error?.command;
    wrappedError.smtpResponse = error?.response;
    throw wrappedError;
  }
};

const sendEmailGeneric = async ({ to, subject, text }) => {
  if (hasResendConfig()) {
    try {
      await sendGenericViaResend({ to, subject, text });
      return;
    } catch (error) {
      error.mailProvider = error.mailProvider || "resend";
      throw error;
    }
  }

  if (!hasSmtpConfig()) {
    const error = new Error("No email provider is configured");
    error.mailProvider = "none";
    throw error;
  }

  await sendGenericViaSmtp({ to, subject, text });
};

export const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  await sendEmailGeneric({
    to,
    subject: "Reset your password",
    text: buildResetEmailText(resetUrl),
  });
};

export const sendVerificationEmail = async ({ to, fullName, otp, verifyUrl }) => {
  await sendEmailGeneric({
    to,
    subject: "Verify your email address",
    text: buildVerificationEmailText({ fullName, otp, verifyUrl }),
  });
};

