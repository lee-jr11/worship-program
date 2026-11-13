import { NextRequest, NextResponse } from 'next/server';
import { GenerateProgramInputSchema } from '@/lib/schema';
import { generateWorshipProgram } from '@/lib/gemini';
import { buildDocx } from '@/lib/docx';
import { sendProgramEmail } from '@/lib/email';

// Allow up to 60 seconds for Gemini generation + Docx build + Gmail SMTP
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();

    // 1. Validate inputs
    const parseResult = GenerateProgramInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid input provided.',
        },
        { status: 400 }
      );
    }

    const { week, theme, verseReference, translation, verseText, email, accessCode } = parseResult.data;

    // 2. Optional Access Code check (if configured in environment)
    const requiredCode = process.env.APP_ACCESS_CODE;
    if (requiredCode && accessCode !== requiredCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid access code.',
        },
        { status: 401 }
      );
    }

    // 3. AI Generation via Gemini 2.0 Flash
    console.log(`[Generate API] Generating program for Week ${week}: ${theme}...`);
    const program = await generateWorshipProgram({
      week,
      theme,
      verseReference,
      translation,
      verseText,
    });

    // 4. Build .docx
    console.log(`[Generate API] Building .docx document...`);
    const docxBuffer = await buildDocx(program);

    // 5. Deliver via Gmail SMTP
    let emailSent = false;
    let emailError: string | undefined;

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (gmailUser && gmailPass) {
      console.log(`[Generate API] Dispatching email to ${email}...`);
      const emailResult = await sendProgramEmail({
        to: email,
        docxBuffer,
        weekNumber: program.week_number,
        theme: program.theme,
      });

      emailSent = emailResult.success;
      emailError = emailResult.error;
    } else {
      console.warn('[Generate API] Gmail SMTP not configured yet. Skipping email dispatch.');
      emailError = 'Gmail SMTP credentials not configured yet in environment.';
    }

    // 6. Return response (with base64 download buffer so user can download directly if needed)
    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      recipientEmail: email,
      filename: `WEDNESDAY WORSHIP PROGRAM WEEK ${program.week_number}.docx`,
      docxBase64: docxBuffer.toString('base64'),
      program,
    });
  } catch (error: unknown) {
    console.error('[Generate API Error]:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred while generating the worship program.';
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
  return NextResponse.json({ error: 'Method Not Allowed. Use POST.' }, { status: 405 });
}
