import { GenerateProgramInputSchema, WorshipProgramSchema, WorshipProgram } from '../src/lib/schema';
import { buildDocx } from '../src/lib/docx';
import { normalizeLlmOutput } from '../src/lib/gemini';
import * as fs from 'fs';
import * as path from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runDiagnostics() {
  console.log('====================================================');
  console.log(' WEDNESDAY WORSHIP PROGRAM — DIAGNOSTIC TEST SUITE  ');
  console.log('====================================================\n');

  // ----------------------------------------------------------------
  // 1. INPUT SCHEMA VALIDATION TESTS
  // ----------------------------------------------------------------
  console.log('[1/5] Testing Input Validation (GenerateProgramInputSchema)...');

  const validGoodInput = {
    day: 'Sunday',
    theme: 'Walking in Faith',
    week: 12,
    verseReference: 'Hebrews 11:1',
    translation: 'NIV',
    email: 'pastor@church.org',
  };
  const parsedGood = GenerateProgramInputSchema.safeParse(validGoodInput);
  assert(parsedGood.success, 'Valid input parses successfully');
  if (parsedGood.success) {
    assert(parsedGood.data.day === 'Sunday', 'Day is preserved');
    assert(parsedGood.data.week === 12, 'Week number coerced to integer');
    assert(parsedGood.data.email === 'pastor@church.org', 'Email normalized to lowercase');
  }

  // Reject invalid weeks
  const badWeekLow = GenerateProgramInputSchema.safeParse({ ...validGoodInput, week: 0 });
  assert(!badWeekLow.success, 'Rejects week 0 (min is 1)');

  const badWeekHigh = GenerateProgramInputSchema.safeParse({ ...validGoodInput, week: 53 });
  assert(!badWeekHigh.success, 'Rejects week 53 (max is 52)');

  // Reject invalid email
  const badEmail = GenerateProgramInputSchema.safeParse({ ...validGoodInput, email: 'notanemail' });
  assert(!badEmail.success, 'Rejects malformed email');

  // Reject empty theme
  const badTheme = GenerateProgramInputSchema.safeParse({ ...validGoodInput, theme: '   ' });
  assert(!badTheme.success, 'Rejects empty theme');

  // ----------------------------------------------------------------
  // 2. OUTPUT SCHEMA CONTRACT TESTS
  // ----------------------------------------------------------------
  console.log('\n[2/5] Testing LLM Output Contract (WorshipProgramSchema)...');

  const validProgramData: WorshipProgram = {
    day: 'Wednesday',
    week_number: 4,
    theme: 'the purpose driven life',
    memory_verse: {
      reference: 'Genesis 12:1-4a',
      text: 'The Lord had said to Abram...',
      translation: 'NIV',
    },
    focus: 'Walking in your God-given purpose always requires leaving comfort behind. What this really means is that a purpose-driven life is not about finding a safe, predictable path. God does not bless us just to make us comfortable; He blesses us so we become a conduit of blessing to others.',
    lesson: 'True purpose is found in stepping out of our comfort zones to follow God direction.',
    application_intro: 'Discovering your purpose requires movement, not just planning:',
    application: [
      { title: 'Leave the familiar', body: 'Be honest about your comfort zone.' },
      { title: 'Trust the unknown', body: 'Discuss taking the first step.' },
      { title: 'Become a blessing', body: 'Leverage your resources for others.' },
      { title: 'Act on the call', body: 'Identify one concrete action today.' },
    ],
    prayer: [
      'Pray for the bold courage to leave behind familiar habits.',
      'Pray that your life will stop being self-centered.',
    ],
  };

  const parsedProgram = WorshipProgramSchema.safeParse(validProgramData);
  assert(parsedProgram.success, 'Valid program schema passes');
  if (parsedProgram.success) {
    assert(parsedProgram.data.theme === 'THE PURPOSE DRIVEN LIFE', 'Theme transformed to UPPERCASE');
    assert(parsedProgram.data.application.length === 4, 'Has exactly 4 application points');
    assert(parsedProgram.data.prayer.length === 2, 'Has exactly 2 prayer points');
  }

  // Reject 3 application points
  const badAppCount = WorshipProgramSchema.safeParse({
    ...validProgramData,
    application: validProgramData.application.slice(0, 3),
  });
  assert(!badAppCount.success, 'Rejects application array with < 4 items');

  // Reject 1 prayer point
  const badPrayerCount = WorshipProgramSchema.safeParse({
    ...validProgramData,
    prayer: ['Pray for courage.'],
  });
  assert(!badPrayerCount.success, 'Rejects prayer array with < 2 items');

  // ----------------------------------------------------------------
  // 3. DOCX BUILDER INTEGRITY TESTS
  // ----------------------------------------------------------------
  console.log('\n[3/5] Testing Docx Document Generation...');

  const startTime = Date.now();
  const buffer = await buildDocx(validProgramData);
  const elapsed = Date.now() - startTime;

  assert(Buffer.isBuffer(buffer), 'buildDocx returns a valid Buffer');
  assert(buffer.length > 5000, `Buffer size is healthy (${buffer.length} bytes, generated in ${elapsed}ms)`);

  // Verify PK zip signature (all docx files start with 0x50 0x4B 0x03 0x04)
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  assert(isZip, 'Docx starts with valid OpenXML ZIP magic bytes (PK..)');

  // ----------------------------------------------------------------
  // 4. ENVIRONMENT & SECURITY AUDIT
  // ----------------------------------------------------------------
  console.log('\n[4/5] Security & Gitignore Audit...');

  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

  assert(gitignoreContent.includes('.env.local'), '.gitignore explicitly blocks .env.local');
  assert(gitignoreContent.includes('!.env.example'), '.gitignore safely allows .env.example');

  const envExamplePath = path.resolve(process.cwd(), '.env.example');
  assert(fs.existsSync(envExamplePath), '.env.example file exists for documentation');

  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  assert(fs.existsSync(envLocalPath), '.env.local exists locally for configuration');

  // ----------------------------------------------------------------
  // 5. LLM OUTPUT NORMALIZATION TESTS
  // ----------------------------------------------------------------
  console.log('\n[5/5] Testing LLM output normalization (normalizeLlmOutput)...');

  const llmParams = {
    day: 'Sunday',
    week: 9,
    theme: '  obedience over comfort  ',
    verseReference: '  1 Samuel 15:22  ',
    translation: ' ESV ',
  };

  const makeRawProgram = (overrides: Record<string, unknown> = {}) => ({
    day: 'Monday',
    week_number: 1,
    theme: 'model supplied theme',
    memory_verse: { reference: 'Model 1:1', text: 'Model supplied verse text', translation: 'KJV' },
    focus: 'A focus paragraph long enough to satisfy the contract validation.',
    lesson: 'Obey quickly.',
    application_intro: 'Framing sentence for the discussion questions.',
    application: [
      { title: 'Leave the familiar', body: 'Name the comfort you are clinging to.' },
      { title: 'Trust the unknown', body: 'Take the first step without the blueprint.' },
      { title: 'Become a blessing', body: 'Spend your resources on someone else.' },
      { title: 'Act on the call', body: 'Commit to one concrete action today.' },
    ],
    prayer: ['Pray for courage to obey.', 'Pray that we stop delaying.'],
    ...overrides,
  });

  const throws = (fn: () => unknown): boolean => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };

  const normalized = normalizeLlmOutput(makeRawProgram(), llmParams, 'Sunday');
  assert(normalized.day === 'Sunday', 'Caller-supplied day overrides the model value');
  assert(normalized.week_number === 9, 'Caller-supplied week overrides the model value');
  assert(normalized.theme === 'OBEDIENCE OVER COMFORT', 'Theme is trimmed and uppercased');
  assert(normalized.memory_verse.reference === '1 Samuel 15:22', 'Verse reference is trimmed and forced');
  assert(normalized.memory_verse.translation === 'ESV', 'Translation is trimmed and forced');
  assert(
    normalized.memory_verse.text === 'Model supplied verse text',
    'Model verse text is kept when no verse text is supplied'
  );

  const withVerseText = normalizeLlmOutput(
    makeRawProgram(),
    { ...llmParams, verseText: '  Supplied verse text  ' },
    'Sunday'
  );
  assert(withVerseText.memory_verse.text === 'Supplied verse text', 'Supplied verse text overrides the model text');

  assert(throws(() => normalizeLlmOutput('not an object', llmParams, 'Sunday')), 'Throws on non-object output (so the caller retries)');
  assert(throws(() => normalizeLlmOutput(null, llmParams, 'Sunday')), 'Throws on null output (so the caller retries)');
  assert(throws(() => normalizeLlmOutput([], llmParams, 'Sunday')), 'Throws on array output (so the caller retries)');
  assert(
    throws(() => normalizeLlmOutput({ day: 'Monday' }, llmParams, 'Sunday')),
    'Throws when memory_verse is missing (so the caller retries)'
  );
  assert(
    throws(() => normalizeLlmOutput(makeRawProgram({ application: [] }), llmParams, 'Sunday')),
    'Throws when the output violates the contract (so the caller retries)'
  );

  console.log('\n====================================================');
  console.log(` RESULTS: ${passedTests} / ${totalTests} tests passed`);
  console.log('====================================================\n');
}

runDiagnostics();
