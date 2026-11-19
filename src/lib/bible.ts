/**
 * Server-side scripture lookup via bible-api.com.
 *
 * The point of this module is fidelity: instead of trusting the model to
 * recall a verse word-for-word, we fetch the real text and force it into the
 * document. bible-api.com requires no key, but it only serves public-domain
 * translations (KJV, WEB, ASV, BSB, Darby, Douay-Rheims). Anything else —
 * NIV, ESV, NKJV, NLT, paraphrases — cannot be fetched here, so the caller
 * falls back to whatever the model produced.
 *
 * Every failure mode (unknown translation, unparseable reference, network
 * error, timeout) resolves to `null` rather than throwing, so a lookup miss
 * never blocks a program from being generated.
 */

/** Ceiling for a single lookup; keeps the route's 60s budget intact. */
export const BIBLE_REQUEST_TIMEOUT_MS = 8_000;

const DEFAULT_BASE_URL = 'https://bible-api.com';

/**
 * Maps the app's translation labels to bible-api.com translation ids.
 * Only public-domain translations are present; a label missing from this map
 * (NIV, ESV, NKJV, NLT, Paraphrased, Other) is simply not fetchable.
 */
const TRANSLATION_IDS: Record<string, string> = {
  KJV: 'kjv',
  WEB: 'web',
  ASV: 'asv',
  BSB: 'bsb',
  DARBY: 'darby',
  DRA: 'dra',
  // The API's own ids are accepted too, so "Other: web" works.
  kjv: 'kjv',
  web: 'web',
  asv: 'asv',
  bsb: 'bsb',
  darby: 'darby',
  dra: 'dra',
};

/**
 * Resolves a translation label to a fetchable bible-api.com id, or null when
 * the translation is not available from the free public-domain API.
 */
export function resolveTranslationId(label: string): string | null {
  const key = label.trim();
  return TRANSLATION_IDS[key] ?? TRANSLATION_IDS[key.toUpperCase()] ?? null;
}

/**
 * Cleans a human reference into something bible-api.com accepts.
 * Mainly it drops sub-verse letter suffixes ("Genesis 12:1-4a" -> "Genesis 12:1-4"),
 * which the API rejects with a 404.
 */
export function normalizeReference(reference: string): string {
  return reference
    .trim()
    .replace(/\s+/g, ' ')
    // Strip the letter that marks a partial verse: "4a", "22b", "1:4a-6".
    .replace(/(\d+)[a-z](?=[-,\s]|$)/gi, '$1');
}

interface BibleApiResponse {
  text?: unknown;
  error?: unknown;
}

export interface FetchVerseOptions {
  reference: string;
  translation: string;
  /** Override for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests; defaults to BIBLE_API_BASE_URL or bible-api.com. */
  baseUrl?: string;
  /** Override for tests; defaults to BIBLE_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Fetches the verse text for a reference and translation.
 * Returns the flat verse text on success, or null when it cannot be fetched
 * (unsupported translation, bad reference, non-JSON response, network error).
 */
export async function fetchVerseText(options: FetchVerseOptions): Promise<string | null> {
  const translationId = resolveTranslationId(options.translation);
  if (!translationId) return null;

  const reference = normalizeReference(options.reference);
  if (!reference) return null;

  const baseUrl = (options.baseUrl ?? process.env.BIBLE_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  // Keep the colon literal (the API expects it) while encoding spaced books.
  const encodedRef = encodeURIComponent(reference).replace(/%3A/gi, ':');
  const url = `${baseUrl}/${encodedRef}?translation=${encodeURIComponent(translationId)}`;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? BIBLE_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    // Unknown translations return an HTML 404 page, not JSON.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;

    const data = (await response.json()) as BibleApiResponse;
    if (data.error) return null;

    const text = typeof data.text === 'string' ? data.text.trim() : '';
    return text || null;
  } catch {
    // Timeouts, DNS failures and parse errors all mean "no fetched text".
    return null;
  }
}
