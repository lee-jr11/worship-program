# Wednesday Worship Program Generator

Turns a weekly theme, week number, Bible verse, and recipient email into a perfectly formatted `.docx` delivered directly by email.

## Stack
- **Framework**: Next.js (App Router, TypeScript, Tailwind CSS)
- **Deployment**: Vercel (Hobby tier - free)
- **AI Engine**: Google Gemini free tier (`gemini-2.0-flash` via `@google/genai`)
- **Document Generation**: `docx` (npm)
- **Email Delivery**: Nodemailer + Gmail SMTP (App Password)

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required values:
   - `GEMINI_API_KEY`: Get a free key at [Google AI Studio](https://aistudio.google.com/) (no credit card required).
   - `GMAIL_USER`: Dedicated church / app Gmail address.
   - `GMAIL_APP_PASSWORD`: 16-character App Password generated from Google Account (Security → 2-Step Verification → App Passwords).
   - `FROM_NAME`: e.g., "Wednesday Worship Program"
   - `APP_ACCESS_CODE`: (Optional) Passcode to protect the endpoint from public bot requests.

3. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run the AI Test Harness:**
   ```bash
   npx tsx scripts/test-gemini.ts
   ```

## Deploying to Vercel

1. Push your repository to GitHub.
2. In Vercel, click **Add New... → Project** and select your repository.
3. In **Settings → Environment Variables**, add:
   - `GEMINI_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `FROM_NAME`
4. Deploy!

## Security Guidelines
- **Never commit `.env.local`**. It is already in `.gitignore`.
- Keys stay server-side in API routes and server actions. No `NEXT_PUBLIC_*` secrets are exposed to the browser.
- If an API key or App Password is ever compromised, revoke it immediately at the provider.
