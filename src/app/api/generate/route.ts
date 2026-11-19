import { NextRequest, NextResponse } from 'next/server';
import { GenerateProgramInputSchema } from '@/lib/schema';
import { generateWorshipProgram } from '@/lib/gemini';
import { buildDocx } from '@/lib/docx';
import { sendProgramEmail } from '@/lib/email';
import { generateRateLimiter, clientKeyFromHeaders } from '@/lib/ratelimit';

// Nodemailer needs TCP sockets, so this route must stay on the Node.js runtime.
export const runtime = 'nodejs';

// Allow up to 60 seconds for AI generation + Docx build + Gmail SMTP
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // 0. Best-effort rate limit: this endpoint spends AI credits and sends mail.
    const limit = generateRateLimiter.check(clientKeyFromHeaders(req.headers));
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
      );
    }

    const rawBody = await req.json();

    // 1. Validate inputs
    const parseResult = GenerateProgramInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'invalid input provided.',
        },
        { status: 400 }
      );
    }

    const { day, week, theme, verseReference, translation, verseText, deliveryMethod, email } = parseResult.data;

    // 2. AI Generation
    console.log(`[Generate API] Generating program for ${day} Week ${week}: ${theme}...`);
    const program = await generateWorshipProgram({
      day,
      week,
      theme,
      verseReference,
      translation,
      verseText,
    });

    // 3. Build .docx
    console.log(`[Generate API] Building .docx document...`);
    const docxBuffer = await buildDocx(program);

    // 4. Deliver via Gmail SMTP (only if deliveryMethod is 'email')
    let emailSent = false;
    let emailError: string | undefined;

    if (deliveryMethod === 'email') {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPass = process.env.GMAIL_APP_PASSWORD;

      if (gmailUser && gmailPass && email) {
        console.log(`[Generate API] Dispatching email to ${email}...`);
        const emailResult = await sendProgramEmail({
          to: email,
          docxBuffer,
          weekNumber: program.week_number,
          theme: program.theme,
          day: program.day,
        });

        emailSent = emailResult.success;
        emailError = emailResult.error;
      } else {
        console.warn('[Generate API] Gmail SMTP not configured yet. Skipping email dispatch.');
        emailError = 'gmail smtp credentials not configured yet in environment.';
      }
    }

    const programDay = (program.day || 'Wednesday').toUpperCase();

    // 5. Return response
    return NextResponse.json({
      success: true,
      deliveryMethod,
      emailSent,
      emailError,
      recipientEmail: email,
      filename: `${programDay} WORSHIP PROGRAM WEEK ${program.week_number}.docx`,
      docxBase64: docxBuffer.toString('base64'),
      program,
    });
  } catch (error: unknown) {
    console.error('[Generate API Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'an unexpected error occurred while generating the worship program.';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method not allowed. use post.' }, { status: 405 });
}
