import { GoogleGenAI, Type, type GenerateContentConfig } from '@google/genai';
import { WorshipProgram, WorshipProgramSchema } from './schema';

/**
 * Per-attempt ceiling for an AI request. Kept well under the route's
 * `maxDuration = 60` so a hung provider cannot consume the whole budget
 * (each provider loop can run 2 attempts, i.e. 2 x 15s worst case).
 */
export const AI_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Model defaults, kept in one place so code, `.env.example` and the README
 * cannot drift apart again.
 *
 * - TokenHarbor: an OpenAI-compatible aggregator; its current free DeepSeek id.
 * - DeepSeek: "deepseek-chat" was retired in favour of "deepseek-flash".
 * - Gemini: fast Flash tiers. Old ids (gemini-1.5-flash, gemini-2.0-flash) are
 *   retired; these are tried in order until one responds.
 */
export const DEFAULT_TOKENHARBOR_MODEL = 'deepseek-v4.1-flash:free';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash';
export const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash'];

/** Substrings of Gemini model ids that accept a zero thinking budget. */
const THINKING_CAPABLE_MODELS = ['2.5', '3.'];

const SYSTEM_INSTRUCTION = `You are an expert pastoral content writer for a weekly worship program.
You will receive:
1. Day of worship (e.g. Wednesday, Sunday, Friday)
2. Week number
3. Theme
4. Bible verse reference
5. Scripture translation

Produce content adhering strictly to the required JSON format.
Tone: Direct, pastoral, practical, second-person ("you"), challenging, no fluff.

STRICT EDITORIAL RULES:
1. day: Use the specified day (e.g. "Wednesday", "Sunday").
2. theme: Always UPPERCASE.
3. memory_verse:
   - reference: Use the supplied reference.
   - translation: Use the supplied translation.
   - text: Provide the accurate, full scripture verse text corresponding to the reference and translation. Do not summarize or paraphrase unless the translation is Paraphrased.
4. focus: Exactly one cohesive paragraph (5–8 sentences) interpreting the verse and explaining what it *really means* for daily life and character. You MUST end this paragraph with a powerful contrast of the form: "God does not [X]; He [Y]."
5. lesson: Exactly one sentence, at most 20 words. A punchy, memorable spiritual takeaway.
6. application_intro: Exactly one short framing sentence introducing the reflection/small-group discussion points.
7. application: Exactly 4 items. Each item must have:
   - title: A 2–4 word imperative title (verb + object/descriptor, e.g. "Leave the familiar", "Audit your circle", "Practice patience").
   - body: 1–3 sentences with a concrete, honest action or reflection prompt for small-group discussion or daily personal application.
8. prayer: Exactly 2 items, 1–2 sentences each. Each must begin with "Pray for..." or "Pray that...".

REQUIRED JSON OUTPUT STRUCTURE:
{
  "day": "Wednesday",
  "week_number": 4,
  "theme": "THE PURPOSE DRIVEN LIFE",
  "memory_verse": {
    "reference": "Genesis 12:1-4a",
    "text": "The Lord had said to Abram, “Go from your country, your people and your father’s household to the land I will show you. I will make you into a great nation, and I will bless you; I will make your name great, and you will be a blessing. I will bless those who bless you, and whoever curses you I will curse; and all peoples on earth will be blessed through you.” So Abram went, as the Lord had told him...",
    "translation": "NIV"
  },
  "focus": "Walking in your God-given purpose always requires leaving comfort behind. In this passage, God calls Abram to step away from his family, his home, and everything familiar. What this really means is that a purpose-driven life is not about finding a safe, predictable path. It is about stepping into the unknown simply because God gave the command. God does not bless us just to make us comfortable; He blesses us so we become a conduit of blessing to others.",
  "lesson": "True purpose is found in stepping out of our comfort zones to follow God's direction.",
  "application_intro": "Discovering your purpose requires movement, not just planning. Let's break it down into key areas for small-group discussion and personal reflection:",
  "application": [
    {
      "title": "Leave the familiar",
      "body": "Be honest about the \\"country\\" or comfort zone God is asking you to step away from right now. Acknowledge what is holding you back."
    },
    {
      "title": "Trust the unknown",
      "body": "Discuss what it takes to take the first step when God says \\"go\\" but does not immediately show you the final destination or the full blueprint."
    },
    {
      "title": "Become a blessing",
      "body": "God blessed Abram so he could bless others. Figure out how you can leverage your current resources, time, or talents to directly benefit someone else this week."
    },
    {
      "title": "Act on the call",
      "body": "Abram did not just sit and think about it; he packed up and went. Identify one concrete action you need to take right now to align your daily routine with God's purpose for your life."
    }
  ],
  "prayer": [
    "Pray for the bold courage to leave behind familiar habits and comfortable spaces the moment God calls you forward.",
    "Pray that your life will stop being self-centered and will instead become a clear, intentional blessing to the people around you."
  ]
}`;

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.STRING },
    week_number: { type: Type.INTEGER },
    theme: { type: Type.STRING },
    memory_verse: {
      type: Type.OBJECT,
      properties: {
        reference: { type: Type.STRING },
        text: { type: Type.STRING },
        translation: { type: Type.STRING },
      },
      required: ['reference', 'text', 'translation'],
    },
    focus: { type: Type.STRING },
    lesson: { type: Type.STRING },
    application_intro: { type: Type.STRING },
    application: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body: { type: Type.STRING },
        },
        required: ['title', 'body'],
      },
    },
    prayer: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'day',
    'week_number',
    'theme',
    'memory_verse',
    'focus',
    'lesson',
    'application_intro',
    'application',
    'prayer',
  ],
};

export interface GenerateProgramParams {
  day?: string;
  week: number;
  theme: string;
  verseReference: string;
  translation: string;
}

/**
 * Safely parses JSON from LLM response text, stripping markdown code blocks if present.
 */
function parseJsonFromLlm(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  }
  return JSON.parse(cleaned);
}

/**
 * Applies the caller-supplied fields (day, verse reference/translation, week
 * number, theme) over the model output, then validates it against the contract.
 * Throws on unusable output so the caller's retry loop can try again.
 */
export function normalizeLlmOutput(raw: unknown, params: GenerateProgramParams, day: string): WorshipProgram {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('AI response was not a JSON object.');
  }

  const draft = raw as Record<string, unknown>;
  const memoryVerse = draft.memory_verse;
  if (typeof memoryVerse !== 'object' || memoryVerse === null || Array.isArray(memoryVerse)) {
    throw new Error('AI response is missing memory_verse.');
  }

  const verse = memoryVerse as Record<string, unknown>;
  verse.reference = params.verseReference.trim();
  verse.translation = params.translation.trim();

  draft.day = day;
  draft.week_number = params.week;
  draft.theme = params.theme.toUpperCase().trim();

  return WorshipProgramSchema.parse(draft);
}

interface ChatCompletionRequest {
  model: string;
  messages: { role: 'system' | 'user'; content: string }[];
  temperature: number;
  response_format?: { type: 'json_object' };
}

/**
 * OpenAI-compatible API Caller (DeepSeek, TokenHarbor, OpenRouter, etc.)
 */
async function generateWithOpenAICompatible(
  apiKey: string,
  params: GenerateProgramParams,
  customBaseUrl?: string,
  customModel?: string
): Promise<WorshipProgram> {
  const day = params.day || 'Wednesday';
  const userPrompt = `Generate the ${day} Worship Program in valid JSON for:
Day: ${day}
Week Number: ${params.week}
Theme: ${params.theme}
Bible Verse Reference: ${params.verseReference}
Translation: ${params.translation}`;

  // Determine endpoint URL
  let endpoint = customBaseUrl || process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL;
  if (!endpoint) {
    // If key looks like a TokenHarbor key (e.g. starts with thk_ or th_) or user set TOKENHARBOR
    if (apiKey.startsWith('thk_') || apiKey.startsWith('th_') || process.env.TOKENHARBOR_API_KEY) {
      endpoint = 'https://tokenharbor.ai/v1';
    } else {
      endpoint = 'https://api.deepseek.com';
    }
  }

  // Normalize endpoint URL to /chat/completions
  const cleanBase = endpoint.replace(/\/+$/, '');
  const completionsUrl = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : cleanBase.endsWith('/v1')
    ? `${cleanBase}/chat/completions`
    : `${cleanBase}/v1/chat/completions`;

  // Determine model
  const model =
    customModel ||
    process.env.AI_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    (endpoint.includes('tokenharbor') ? DEFAULT_TOKENHARBOR_MODEL : DEFAULT_DEEPSEEK_MODEL);

  console.log(`[AI Request] Dispatching to: ${completionsUrl} (model: ${model})`);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Build request body
      const requestBody: ChatCompletionRequest = {
        model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      };

      // Add response_format on first attempt (some proxies may not support json_object)
      if (attempt === 1) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned an empty response.');
      }

      return normalizeLlmOutput(parseJsonFromLlm(content), params, day);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI Attempt ${attempt} Failed]:`, lastError.message);
    }
  }

  throw new Error(`Failed to generate valid worship program: ${lastError?.message}`);
}

/**
 * Gemini API Caller
 */
async function generateWithGemini(apiKey: string, params: GenerateProgramParams): Promise<WorshipProgram> {
  // Use v1beta so developer/system instructions and modern schema validation are supported
  const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  const day = params.day || 'Wednesday';
  const configuredModel = process.env.GEMINI_MODEL;
  const userPrompt = `Generate the ${day} Worship Program for:
Day: ${day}
Week Number: ${params.week}
Theme: ${params.theme}
Bible Verse Reference: ${params.verseReference}
Translation: ${params.translation}`;

  let lastError: Error | null = null;
  const candidateModels = configuredModel ? [configuredModel] : DEFAULT_GEMINI_MODELS;

  for (let attempt = 1; attempt <= candidateModels.length; attempt++) {
    const currentModel = candidateModels[attempt - 1];
    try {
      console.log(`[Gemini Request] Calling ${currentModel} (attempt ${attempt})...`);
      const config: GenerateContentConfig = {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.7,
        abortSignal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      };

      // Thinking-capable models honour a zero thinking budget, which keeps
      // latency down; models that lack the field ignore it.
      if (THINKING_CAPABLE_MODELS.some((id) => currentModel.includes(id))) {
        config.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: userPrompt,
        config,
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      return normalizeLlmOutput(parseJsonFromLlm(responseText), params, day);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini Attempt ${attempt} (${currentModel}) Failed]:`, lastError.message);
    }
  }

  throw new Error(`Failed to generate valid worship program from Gemini: ${lastError?.message}`);
}

/**
 * Universal Worship Program Generator:
 * Automatically detects whether you are using:
 * 1. TokenHarbor / OpenAI-compatible proxy (TOKENHARBOR_API_KEY or AI_BASE_URL)
 * 2. DeepSeek (DEEPSEEK_API_KEY)
 * 3. Google Gemini (GEMINI_API_KEY)
 */
export async function generateWorshipProgram(params: GenerateProgramParams): Promise<WorshipProgram> {
  // Check for TokenHarbor key explicitly
  const tokenHarborKey = process.env.TOKENHARBOR_API_KEY;
  // Reject the placeholder values shipped in .env.example so an unfilled copy
  // fails fast instead of making a doomed API call.
  const tokenHarborPlaceholders = ['your_tokenharbor_api_key_here', 'thk_your_tokenharbor_key_here'];
  if (tokenHarborKey && !tokenHarborPlaceholders.includes(tokenHarborKey)) {
    return generateWithOpenAICompatible(
      tokenHarborKey,
      params,
      process.env.AI_BASE_URL || 'https://tokenharbor.ai/v1',
      process.env.AI_MODEL || DEFAULT_TOKENHARBOR_MODEL
    );
  }

  // Check for DeepSeek / Generic key
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey !== 'your_deepseek_api_key_here') {
    return generateWithOpenAICompatible(deepseekKey, params);
  }

  // Check for Gemini key
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    return generateWithGemini(geminiKey, params);
  }

  throw new Error(
    'No valid AI API key found. Please provide TOKENHARBOR_API_KEY, DEEPSEEK_API_KEY, or GEMINI_API_KEY in .env.local.'
  );
}
