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

// Network/DNS blips are worth one retry; auth and message errors are not.
const RETRYABLE_SMTP_CODES = new Set(['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN', 'EDNS']);

function isTransientSmtpError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && RETRYABLE_SMTP_CODES.has(code)) return true;
  // Nodemailer reports some DNS failures only in the message text.
  return /timed out|EAI_AGAIN|ENOTFOUND/i.test(error.message) && !/auth/i.test(error.message);
}

/**
 * Sends the generated .docx program to the specified recipient via Gmail SMTP.
 * Retries once on a transient connection/DNS failure so a blip does not fail the send.
 */
export async function sendProgramEmail(options: SendProgramEmailOptions): Promise<SendEmailResult> {
  const { to, docxBuffer, weekNumber, theme } = options;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const fromName = process.env.FROM_NAME || 'Wednesday Worship Program';

  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD is not configured.');
  }

  // Use Nodemailer with 'service: gmail' (which includes pre-configured hosts and settings)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.replace(/\s+/g, ''), // Strip any spaces from the 16-character app password
    },
    tls: {
      rejectUnauthorized: false, // Prevents certificate rejection on local proxies
    },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  const programDay = options.day || 'Wednesday';
  const filename = `${programDay.toUpperCase()} WORSHIP PROGRAM WEEK ${weekNumber}.docx`;
  const subject = `${programDay} Worship Program — Week ${weekNumber}: ${theme.toUpperCase()}`;
  const textBody = `Attached is the ${programDay} Worship Program for Week ${weekNumber} (${theme.toUpperCase()}).\n\nGod bless.`;

  const message = {
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
      const info = await transporter.sendMail(message);
      console.log(`[Email Sent Successfully] MessageId: ${info.messageId} (attempt ${attempt}/${maxAttempts})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      lastErrorMessage = error instanceof Error ? error.message : lastErrorMessage;
      const willRetry = attempt < maxAttempts && isTransientSmtpError(error);
      console.error(`[Email Delivery Error${willRetry ? ' - retrying once' : ''}]:`, error);
      if (!willRetry) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  return {
    success: false,
    error: lastErrorMessage,
  };
}
