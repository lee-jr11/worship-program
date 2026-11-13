import nodemailer from 'nodemailer';

export interface SendProgramEmailOptions {
  to: string;
  docxBuffer: Buffer;
  weekNumber: number;
  theme: string;
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

  // Create Nodemailer transporter using Gmail SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 is SSL/TLS
    auth: {
      user,
      pass,
    },
    // Helpful timeouts
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const filename = `WEDNESDAY WORSHIP PROGRAM WEEK ${weekNumber}.docx`;
  const subject = `Wednesday Worship Program — Week ${weekNumber}: ${theme.toUpperCase()}`;
  const textBody = `Attached is the Wednesday Worship Program for Week ${weekNumber} (${theme.toUpperCase()}).\n\nGod bless.`;

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${user}>`,
      to,
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
