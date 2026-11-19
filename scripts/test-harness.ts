import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { generateWorshipProgram } from '../src/lib/gemini';
import { buildDocx } from '../src/lib/docx';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SAMPLE_WEEKS = [
  {
    week: 4,
    theme: 'THE PURPOSE DRIVEN LIFE',
    verseReference: 'Genesis 12:1-4a',
    translation: 'NIV',
  },
  {
    week: 6,
    theme: 'PATIENCE, FAITHFULNESS AND SELF-CONTROL',
    verseReference: '2 Peter 1:5-7',
    translation: 'Paraphrased',
  },
  {
    week: 7,
    theme: 'OUR RESPONSIBILITY, OUR CHARACTER',
    verseReference: 'Galatians 5:25-26',
    translation: 'NIV',
  },
];

async function run() {
  console.log('=== Wednesday Worship Program Test Harness ===\n');

  const tokenHarborKey = process.env.TOKENHARBOR_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // Placeholder values from .env.example must not count as a configured key.
  const tokenHarborPlaceholders = ['your_tokenharbor_api_key_here', 'thk_your_tokenharbor_key_here'];

  const hasTokenHarbor = tokenHarborKey && !tokenHarborPlaceholders.includes(tokenHarborKey);
  const hasDeepSeek = deepseekKey && deepseekKey !== 'your_deepseek_api_key_here';
  const hasGemini = geminiKey && geminiKey !== 'your_gemini_api_key_here';

  if (!hasTokenHarbor && !hasDeepSeek && !hasGemini) {
    console.error(
      '❌ Error: No usable AI key found in .env.local (checked TOKENHARBOR_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY)'
    );
    console.log('Please add your TokenHarbor, DeepSeek or Gemini API key to worship-program/.env.local first.');
    process.exit(1);
  }

  // Mirror the precedence in src/lib/gemini.ts: TokenHarbor → DeepSeek → Gemini.
  if (hasTokenHarbor) {
    const baseUrl = process.env.AI_BASE_URL || 'https://tokenharbor.ai/v1';
    const model = process.env.AI_MODEL || 'deepseek-v4.1-flash:free';
    console.log(`⚡ Using TokenHarbor as AI provider (model: ${model}, endpoint: ${baseUrl}).`);
  } else if (hasDeepSeek) {
    console.log('⚡ Using DeepSeek (deepseek-chat) as AI provider.');
  } else {
    console.log('⚡ Using Google Gemini (gemini-2.0-flash) as AI provider.');
  }

  const outputDir = path.resolve(process.cwd(), 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const sample of SAMPLE_WEEKS) {
    console.log(`\n--------------------------------------------`);
    console.log(`Generating Week ${sample.week}: ${sample.theme}...`);
    try {
      const startTime = Date.now();
      const program = await generateWorshipProgram(sample);
      const elapsedMs = Date.now() - startTime;

      console.log(`✅ Gemini output received in ${(elapsedMs / 1000).toFixed(1)}s!`);
      console.log(`  - Theme: ${program.theme}`);
      console.log(`  - Focus: ${program.focus.substring(0, 80)}...`);
      console.log(`  - Lesson: ${program.lesson}`);
      console.log(`  - Application items: ${program.application.length}`);
      console.log(`  - Prayer items: ${program.prayer.length}`);

      // Now generate .docx
      console.log(`Building .docx for Week ${sample.week}...`);
      const docxBuffer = await buildDocx(program);
      const filePath = path.join(outputDir, `TEST_WEEK_${sample.week}.docx`);
      fs.writeFileSync(filePath, docxBuffer);
      console.log(`✅ Saved docx to: ${filePath} (${docxBuffer.length} bytes)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed Week ${sample.week}:`, msg);
    }
  }

  console.log('\n=== Test harness completed ===');
}

run();
