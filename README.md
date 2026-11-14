# Worship Program Generator

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
   - **AI provider** (pick one, checked in this order):
     - `TOKENHARBOR_API_KEY`: TokenHarbor key (`thk_...`). Optional overrides: `AI_BASE_URL` (default `https://tokenharbor.ai/v1`) and `AI_MODEL` (default `deepseek-v4.1-flash:free`).
     - `DEEPSEEK_API_KEY`: Direct DeepSeek key.
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

4. **Run the offline diagnostics** (no API key or network needed):
   ```bash
   npm test
   ```

5. **Run the live AI Test Harness** (calls your AI provider and writes `.docx` files to `test-output/`, which is gitignored):
   ```bash
   npm run test:live
   ```

   To regenerate the Week 4 reference document from fixed data without calling the AI:
   ```bash
   npx tsx scripts/test-docx-offline.ts
   ```

6. **Run the design audit** (impeccable's deterministic UI anti-pattern scan, no API key):
   ```bash
   npm run design:audit          # source rules
   npm run design:audit:page     # rendered rules, needs the dev server on :3000
   ```

## Deploying to Vercel

1. Push your repository to GitHub.
2. In Vercel, click **Add New... → Project** and select your repository.
3. In **Settings → Environment Variables**, add:
   - One of `TOKENHARBOR_API_KEY` (plus optional `AI_BASE_URL`, `AI_MODEL`), `DEEPSEEK_API_KEY`, or `GEMINI_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `FROM_NAME`
4. Deploy!

## Security Guidelines
- **Never commit `.env.local`**. It is already in `.gitignore`.
- Keys stay server-side in API routes and server actions. No `NEXT_PUBLIC_*` secrets are exposed to the browser.
- If an API key or App Password is ever compromised, revoke it immediately at the provider.
