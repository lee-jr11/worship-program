import nodemailer from 'nodemailer';
import dns from 'dns';

// Prevent Windows IPv6 DNS timeout on getaddrinfo
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore in environments where not supported
}

export interface SendProgramEmailOptions {
  to: string;
  docxBuffer: Buffer;
  weekNumber: number;
  theme: string;
  day?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ProgramMailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
}

/** The single transport capability this module needs; nodemailer's Transporter satisfies it. */
export interface Mailer {
  sendMail(message: ProgramMailMessage): Promise<{ messageId?: string }>;
}

export interface EmailLogger {
  log(message: string): void;
  error(message: string, error?: unknown): void;
}

export interface SendProgramEmailDeps {
  /** Override for tests; defaults to a real nodemailer Gmail transport. */
  createMailer?: (credentials: { user: string; pass: string }) => Mailer;
  /** Backoff before the retry attempt. Defaults to 1500ms. */
  retryDelayMs?: number;
  /** Override for tests; defaults to the console. */
  logger?: EmailLogger;
}

// Network/DNS blips are worth one retry; auth and message errors are not.
const RETRYABLE_SMTP_CODES = new Set(['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN', 'EDNS']);

function isTransientSmtpError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && RETRYABLE_SMTP_CODES.has(code)) return true;
  // Nodemailer reports some DNS failures only in the message text.
  return /timed out|EAI_AGAIN|ENOTFOUND/i.test(error.message) && !/auth/i.test(error.message);
}

function createGmailMailer({ user, pass }: { user: string; pass: string }): Mailer {
  // Certificate verification must stay ON in production. Only relax it when
  // explicitly opted in (e.g. a local dev box behind a TLS-terminating proxy),
  // so mail credentials and content cannot be intercepted in transit.
  const allowInsecureTls =
    process.env.SMTP_ALLOW_INSECURE_TLS === 'true' && process.env.NODE_ENV !== 'production';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    ...(allowInsecureTls ? { tls: { rejectUnauthorized: false } } : {}),
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return {
    sendMail: (message) => transporter.sendMail(message),
  };
}

/**
 * Sends the generated .docx program to the specified recipient via Gmail SMTP.
 * Retries once on a transient connection/DNS failure so a blip does not fail the send.
 */
export async function sendProgramEmail(
  options: SendProgramEmailOptions,
  deps: SendProgramEmailDeps = {}
): Promise<SendEmailResult> {
  const { to, docxBuffer, weekNumber, theme } = options;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const fromName = process.env.FROM_NAME || 'Wednesday Worship Program';

  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not configured.');
  }

  const createMailer = deps.createMailer ?? createGmailMailer;
  const retryDelayMs = deps.retryDelayMs ?? 1500;
  const logger = deps.logger ?? console;

  const mailer = createMailer({
    user: user.trim(),
    pass: pass.replace(/\s+/g, ''), // Strip any spaces from the 16-character app password
  });

  const programDay = options.day || 'Wednesday';
  const filename = `${programDay.toUpperCase()} WORSHIP PROGRAM WEEK ${weekNumber}.docx`;
  const subject = `${programDay} Worship Program — Week ${weekNumber}: ${theme.toUpperCase()}`;
  const textBody = `Attached is the ${programDay} Worship Program for Week ${weekNumber} (${theme.toUpperCase()}).\n\nGod bless.`;

  const message: ProgramMailMessage = {
    from: `"${fromName}" <${user.trim()}>`,
    to: to.trim(),
    subject,
    text: textBody,
    attachments: [
      {
        filename,
        content: docxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  };

  const maxAttempts = 2;
  let lastErrorMessage = 'Failed to send email via Gmail SMTP';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await mailer.sendMail(message);
      logger.log(`[Email Sent Successfully] MessageId: ${info.messageId} (attempt ${attempt}/${maxAttempts})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      lastErrorMessage = error instanceof Error ? error.message : lastErrorMessage;
      const willRetry = attempt < maxAttempts && isTransientSmtpError(error);
      logger.error(`[Email Delivery Error${willRetry ? ' - retrying once' : ''}]:`, error);
      if (!willRetry) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return {
    success: false,
    error: lastErrorMessage,
  };
}
