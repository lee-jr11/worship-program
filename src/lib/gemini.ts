import { GoogleGenAI, Type } from '@google/genai';
import { WorshipProgram, WorshipProgramSchema } from './schema';

const SYSTEM_INSTRUCTION = `You are an expert pastoral content writer for a weekly Wednesday worship program.
You will receive:
1. Week number
2. Theme
3. Bible verse reference
4. Scripture translation
5. Bible verse text (provided by the user)

Produce content adhering strictly to the required JSON format.
Tone: Direct, pastoral, practical, second-person ("you"), challenging, no fluff.

STRICT EDITORIAL RULES:
1. theme: Always UPPERCASE.
2. memory_verse:
   - reference: Use the supplied reference.
   - text: Use the supplied verse text VERBATIM. Do not alter, omit, or add scripture.
   - translation: Use the supplied translation.
3. focus: Exactly one cohesive paragraph (5–8 sentences) interpreting the verse and explaining what it *really means* for daily life and character. You MUST end this paragraph with a powerful contrast of the form: "God does not [X]; He [Y]."
4. lesson: Exactly one sentence, at most 20 words. A punchy, memorable spiritual takeaway.
5. application_intro: Exactly one short framing sentence introducing the reflection/small-group discussion points.
6. application: Exactly 4 items. Each item must have:
   - title: A 2–4 word imperative title (verb + object/descriptor, e.g. "Leave the familiar", "Audit your circle", "Practice patience").
   - body: 1–3 sentences with a concrete, honest action or reflection prompt for small-group discussion or daily personal application.
7. prayer: Exactly 2 items, 1–2 sentences each. Each must begin with "Pray for..." or "Pray that...".

REQUIRED JSON OUTPUT STRUCTURE:
{
  "week_number": 4,
  "theme": "THE PURPOSE DRIVEN LIFE",
  "memory_verse": {
    "reference": "Genesis 12:1-4a",
    "text": "The Lord had said to Abram...",
    "translation": "NIV"
  },
  "focus": "Walking in your God-given purpose always requires leaving comfort behind...",
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
  week: number;
  theme: string;
  verseReference: string;
  translation: string;
  verseText: string;
}

/**
 * DeepSeek API Caller (OpenAI-compatible format)
 */
async function generateWithDeepSeek(apiKey: string, params: GenerateProgramParams): Promise<WorshipProgram> {
  const userPrompt = `Generate the Wednesday Worship Program in valid JSON for:
Week Number: ${params.week}
Theme: ${params.theme}
Bible Verse Reference: ${params.verseReference}
Translation: ${params.translation}
Verse Text: ${params.verseText}`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('DeepSeek returned an empty response.');
      }

      const parsedJson = JSON.parse(content);
      parsedJson.memory_verse.text = params.verseText.trim();
      parsedJson.memory_verse.reference = params.verseReference.trim();
      parsedJson.memory_verse.translation = params.translation.trim();
      parsedJson.week_number = params.week;
      parsedJson.theme = params.theme.toUpperCase().trim();

      return WorshipProgramSchema.parse(parsedJson);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[DeepSeek Attempt ${attempt} Failed]:`, lastError.message);
    }
  }

  throw new Error(`Failed to generate valid worship program from DeepSeek: ${lastError?.message}`);
}

/**
 * Gemini API Caller
 */
async function generateWithGemini(apiKey: string, params: GenerateProgramParams): Promise<WorshipProgram> {
  const ai = new GoogleGenAI({ apiKey });
  const userPrompt = `Generate the Wednesday Worship Program for:
Week Number: ${params.week}
Theme: ${params.theme}
Bible Verse Reference: ${params.verseReference}
Translation: ${params.translation}
Verse Text: ${params.verseText}`;

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.7,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error('Gemini returned an empty response.');
      }

      const parsedJson = JSON.parse(responseText);
      parsedJson.memory_verse.text = params.verseText.trim();
      parsedJson.memory_verse.reference = params.verseReference.trim();
      parsedJson.memory_verse.translation = params.translation.trim();
      parsedJson.week_number = params.week;
      parsedJson.theme = params.theme.toUpperCase().trim();

      return WorshipProgramSchema.parse(parsedJson);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini Attempt ${attempt} Failed]:`, lastError.message);
    }
  }

  throw new Error(`Failed to generate valid worship program from Gemini: ${lastError?.message}`);
}

/**
 * Universal Worship Program Generator:
 * Automatically uses DeepSeek if DEEPSEEK_API_KEY is configured,
 * or Gemini if GEMINI_API_KEY is configured.
 */
export async function generateWorshipProgram(params: GenerateProgramParams): Promise<WorshipProgram> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && deepseekKey !== 'your_deepseek_api_key_here') {
    return generateWithDeepSeek(deepseekKey, params);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    return generateWithGemini(geminiKey, params);
  }

  throw new Error(
    'No valid AI API key found. Please provide either DEEPSEEK_API_KEY or GEMINI_API_KEY in .env.local.'
  );
}
