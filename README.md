# Worship Program Generator

Turns a weekly theme, week number, Bible verse, and recipient email into a perfectly formatted `.docx` delivered directly by email.

## Stack
- **Framework**: Next.js (App Router, TypeScript, Tailwind CSS)
- **Deployment**: Vercel (Hobby tier - free)
- **AI Engine**: `@google/genai` (Gemini Flash free tier) or an OpenAI-compatible provider (TokenHarbor / DeepSeek)
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
     - `DEEPSEEK_API_KEY`: Direct DeepSeek key (default model `deepseek-flash`).
     - `GEMINI_API_KEY`: Get a free key at [Google AI Studio](https://aistudio.google.com/) (no credit card required). Models tried in order: `gemini-2.5-flash`, `gemini-3.8-flash` (override with `GEMINI_MODEL`).
   - `GMAIL_USER`: Dedicated church / app Gmail address.
   - `GMAIL_APP_PASSWORD`: 16-character App Password generated from Google Account (Security → 2-Step Verification → App Passwords).
   - `FROM_NAME`: e.g., "Wednesday Worship Program"
   - `SMTP_ALLOW_INSECURE_TLS` (optional, dev-only): set to `true` on a local machine behind a TLS-terminating proxy. Ignored when `NODE_ENV=production`.
   - `BIBLE_API_BASE_URL` (optional): override the scripture lookup base URL. Defaults to `https://bible-api.com`.

   **Scripture fidelity:** the route fetches the exact verse text server-side from [bible-api.com](https://bible-api.com) and forces it into the document, so the printed scripture is real wording rather than the model's recollection. That API needs no key but only serves **public-domain** translations (KJV, WEB, ASV, BSB, Darby, Douay-Rheims). For NIV, ESV, NKJV, NLT or a paraphrase the lookup cannot run, and the app falls back to the model's text — set `BIBLE_API_BASE_URL` to a licensed provider if you need those.

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
2. In Vercel, click **Add New... → Project** and select your repository. Leave the framework preset, build command, and output directory at their defaults.
3. In **Settings → Environment Variables**, add (Production):
   - One of `TOKENHARBOR_API_KEY` (plus optional `AI_BASE_URL`, `AI_MODEL`), `DEEPSEEK_API_KEY`, or `GEMINI_API_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `FROM_NAME`
4. (Recommended) Protect the public deployment at the hosting layer so strangers cannot spend your AI credits or send mail from `GMAIL_USER`: in Vercel, Project Settings → Deployment Protection (password or SSO). The app itself has no user-facing access code.
5. Deploy!

`/api/generate` is pinned to `export const runtime = 'nodejs'` with `maxDuration = 60`: nodemailer needs real TCP sockets, and Vercel blocks outbound port 25 while leaving Gmail's 465/587 open. The app has no localhost references and reads every integration detail from environment variables, so nothing needs editing per environment.

## Security Guidelines
- **Never commit `.env.local`**. It is already in `.gitignore`.
- Keys stay server-side in API routes and server actions. No `NEXT_PUBLIC_*` secrets are exposed to the browser.
- `/api/generate` applies a best-effort in-memory rate limit (10 requests/minute per client). On serverless hosting each instance keeps its own counters, so it is a soft guard only — still protect the deployment at the hosting layer.
- SMTP certificate verification is on. Only set `SMTP_ALLOW_INSECURE_TLS=true` on a local dev machine behind a TLS-terminating proxy; it is ignored when `NODE_ENV=production`.
- If an API key or App Password is ever compromised, revoke it immediately at the provider.
