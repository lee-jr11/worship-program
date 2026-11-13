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
    verseText:
      'The Lord had said to Abram, “Go from your country, your people and your father’s household to the land I will show you. I will make you into a great nation, and I will bless you; I will make your name great, and you will be a blessing. I will bless those who bless you, and whoever curses you I will curse; and all peoples on earth will be blessed through you.” So Abram went, as the Lord had told him...',
  },
  {
    week: 6,
    theme: 'PATIENCE, FAITHFULNESS AND SELF-CONTROL',
    verseReference: '2 Peter 1:5-7',
    translation: 'Paraphrased',
    verseText:
      'Make every effort to add to your faith goodness; and to goodness, knowledge; and to knowledge, self-control; and to self-control, perseverance; and to perseverance, godliness; and to godliness, mutual affection; and to mutual affection, love.',
  },
  {
    week: 7,
    theme: 'OUR RESPONSIBILITY, OUR CHARACTER',
    verseReference: 'Galatians 5:25-26',
    translation: 'NIV',
    verseText:
      'Since we live by the Spirit, let us keep in step with the Spirit. Let us not become conceited, provoking and envying each other.',
  },
];

async function run() {
  console.log('=== Wednesday Worship Program Test Harness ===\n');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.error('❌ Error: GEMINI_API_KEY is not set in .env.local');
    console.log('Please add your free Gemini API key to worship-program/.env.local first.');
    process.exit(1);
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
    } catch (err: any) {
      console.error(`❌ Failed Week ${sample.week}:`, err.message || err);
    }
  }

  console.log('\n=== Test harness completed ===');
}

run();
