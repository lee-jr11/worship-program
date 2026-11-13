import { GoogleGenAI, Type } from '@google/genai';
import { WorshipProgram, WorshipProgramSchema } from './schema';

const SYSTEM_INSTRUCTION = `You are an expert pastoral content writer for a weekly Wednesday worship program.
You will receive:
1. Week number
2. Theme
3. Bible verse reference
4. Scripture translation
5. Bible verse text (provided by the user)

Produce content adhering strictly to the required JSON schema.
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

FEW-SHOT REFERENCE EXAMPLE (WEEK 4):
{
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

export async function generateWorshipProgram(params: GenerateProgramParams): Promise<WorshipProgram> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const userPrompt = `Generate the Wednesday Worship Program for:
Week Number: ${params.week}
Theme: ${params.theme}
Bible Verse Reference: ${params.verseReference}
Translation: ${params.translation}
Verse Text: ${params.verseText}`;

  // Helper with retry on invalid output
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

      // Enforce the user's exact verse text in case of any slight LLM mutation
      parsedJson.memory_verse.text = params.verseText.trim();
      parsedJson.memory_verse.reference = params.verseReference.trim();
      parsedJson.memory_verse.translation = params.translation.trim();
      parsedJson.week_number = params.week;
      parsedJson.theme = params.theme.toUpperCase().trim();

      // Validate against the Zod schema
      return WorshipProgramSchema.parse(parsedJson);
    } catch (err) {
      lastError = err as Error;
      console.warn(`[Gemini Attempt ${attempt} Failed]:`, err);
    }
  }

  throw new Error(`Failed to generate valid worship program from Gemini: ${lastError?.message}`);
}
