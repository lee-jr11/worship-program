import { Document, Paragraph, TextRun, Packer } from 'docx';
import { WorshipProgram } from './schema';
import { DOCX_STYLES } from './styles';

/**
 * Builds a formatted .docx buffer from a structured WorshipProgram object.
 * Perfectly reproduces the styling, paragraph spacing, and bolding of the church's sample bulletins.
 */
export async function buildDocx(program: WorshipProgram): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: DOCX_STYLES.font,
            size: DOCX_STYLES.fontSize,
          },
          paragraph: {
            spacing: {
              line: DOCX_STYLES.spacing.line,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: DOCX_STYLES.margins,
          },
        },
        children: [
          // 1. Program Title
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.titleProgramAfter },
            children: [
              new TextRun({
                text: `${(program.day || 'Wednesday').toUpperCase()} WORSHIP PROGRAM`,
                bold: true,
                size: DOCX_STYLES.titleSize,
              }),
            ],
          }),

          // 2. Week Number & Theme
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.titleThemeAfter },
            children: [
              new TextRun({
                text: `WEEK ${program.week_number}: ${program.theme.toUpperCase()}`,
                bold: true,
                size: DOCX_STYLES.titleSize,
              }),
            ],
          }),

          // 3. Memory Verse
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.sectionAfter },
            children: [
              new TextRun({
                text: `Memory Verse: ${program.memory_verse.reference}`,
                bold: true,
              }),
              new TextRun({
                // Verse text starts on its own line, beneath the reference.
                text: `${program.memory_verse.text} (${program.memory_verse.translation})`,
                break: 1,
              }),
            ],
          }),

          // 4. Focus
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.sectionAfter },
            children: [
              new TextRun({
                text: 'Focus: ',
                bold: true,
              }),
              new TextRun({
                text: program.focus,
              }),
            ],
          }),

          // 5. Lesson
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.sectionAfter },
            children: [
              new TextRun({
                text: 'Lesson: ',
                bold: true,
              }),
              new TextRun({
                text: program.lesson,
              }),
            ],
          }),

          // 6. Application Header & Intro
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.introAfter },
            children: [
              new TextRun({
                text: 'Application: ',
                bold: true,
              }),
              new TextRun({
                text: program.application_intro,
              }),
            ],
          }),

          // 7. Application Points (1 to 4)
          ...program.application.map((item, index) =>
            new Paragraph({
              spacing: { after: DOCX_STYLES.spacing.listItemAfter },
              children: [
                new TextRun({
                  text: `${index + 1}. `,
                  bold: true,
                }),
                new TextRun({
                  text: `${item.title.trim()}: `,
                  bold: true,
                }),
                new TextRun({
                  text: item.body,
                }),
              ],
            })
          ),

          // 8. Prayer Header
          new Paragraph({
            spacing: { after: DOCX_STYLES.spacing.introAfter },
            children: [
              new TextRun({
                text: 'Prayer:',
                bold: true,
              }),
            ],
          }),

          // 9. Prayer Points (1 to 2)
          ...program.prayer.map((item, index) =>
            new Paragraph({
              spacing: { after: DOCX_STYLES.spacing.listItemAfter },
              children: [
                new TextRun({
                  text: `${index + 1}. `,
                  bold: true,
                }),
                new TextRun({
                  text: item.replace(/^\d+\.\s*/, ''), // Strip any accidental leading numbering
                }),
              ],
            })
          ),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
