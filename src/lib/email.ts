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

/**
 * Sends the generated .docx program to the specified recipient via Gmail SMTP.
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

  try {
    const info = await transporter.sendMail({
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
    });

    console.log(`[Email Sent Successfully] MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    console.error('[Email Delivery Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email via Gmail SMTP';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
