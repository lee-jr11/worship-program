import * as path from 'path';
import * as fs from 'fs';
import { buildDocx } from '../src/lib/docx';
import { WorshipProgram } from '../src/lib/schema';

const WEEK_4_DATA: WorshipProgram = {
  week_number: 4,
  theme: 'THE PURPOSE DRIVEN LIFE',
  memory_verse: {
    reference: 'Genesis 12:1-4a',
    text: 'The Lord had said to Abram, “Go from your country, your people and your father’s household to the land I will show you. I will make you into a great nation, and I will bless you; I will make your name great, and you will be a blessing. I will bless those who bless you, and whoever curses you I will curse; and all peoples on earth will be blessed through you.” So Abram went, as the Lord had told him...',
    translation: 'NIV',
  },
  focus:
    'Walking in your God-given purpose always requires leaving comfort behind. In this passage, God calls Abram to step away from his family, his home, and everything familiar. What this really means is that a purpose-driven life is not about finding a safe, predictable path. It is about stepping into the unknown simply because God gave the command. God does not bless us just to make us comfortable; He blesses us so we become a conduit of blessing to others.',
  lesson: "True purpose is found in stepping out of our comfort zones to follow God's direction.",
  application_intro:
    "Discovering your purpose requires movement, not just planning. Let's break it down into key areas for small-group discussion and personal reflection:",
  application: [
    {
      title: 'Leave the familiar',
      body: 'Be honest about the "country" or comfort zone God is asking you to step away from right now. Acknowledge what is holding you back.',
    },
    {
      title: 'Trust the unknown',
      body: 'Discuss what it takes to take the first step when God says "go" but does not immediately show you the final destination or the full blueprint.',
    },
    {
      title: 'Become a blessing',
      body: 'God blessed Abram so he could bless others. Figure out how you can leverage your current resources, time, or talents to directly benefit someone else this week.',
    },
    {
      title: 'Act on the call',
      body: 'Abram did not just sit and think about it; he packed up and went. Identify one concrete action you need to take right now to align your daily routine with God\'s purpose for your life.',
    },
  ],
  prayer: [
    'Pray for the bold courage to leave behind familiar habits and comfortable spaces the moment God calls you forward.',
    'Pray that your life will stop being self-centered and will instead become a clear, intentional blessing to the people around you.',
  ],
};

async function testDocx() {
  console.log('Testing docx generation offline with Week 4 data...');
  const outputDir = path.resolve(process.cwd(), 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const docxBuffer = await buildDocx(WEEK_4_DATA);
  const outPath = path.join(outputDir, 'WEDNESDAY_WORSHIP_PROGRAM_WEEK_4_REPLICA.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log(`✅ Generated replica docx: ${outPath} (${docxBuffer.length} bytes)`);
}

testDocx();
