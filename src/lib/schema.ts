import { z } from 'zod';

// Input payload schema from the frontend form
export const GenerateProgramInputSchema = z.object({
  day: z.string().trim().min(1, 'Day is required').default('Wednesday'),
  week: z.coerce.number().int().min(1, 'Week must be at least 1').max(52, 'Week cannot exceed 52'),
  theme: z.string().trim().min(1, 'Theme is required'),
  verseReference: z.string().trim().min(1, 'Bible verse reference is required'),
  translation: z.string().trim().min(1, 'Translation is required').default('NIV'),
  email: z.string().trim().email('Please enter a valid email address').transform(e => e.toLowerCase()),
  accessCode: z.string().optional(),
});

export type GenerateProgramInput = z.infer<typeof GenerateProgramInputSchema>;

// Contract schema for LLM output and Docx generator
export const WorshipProgramSchema = z.object({
  day: z.string().optional().default('Wednesday'),
  week_number: z.number().int().min(1).max(52),
  theme: z.string().min(1).transform(t => t.toUpperCase()),
  memory_verse: z.object({
    reference: z.string().min(1),
    text: z.string().min(1),
    translation: z.string().min(1),
  }),
  focus: z.string().min(10, 'Focus section is too short'),
  lesson: z.string().min(5, 'Lesson must be a punchy sentence'),
  application_intro: z.string().min(5, 'Application intro is required'),
  application: z.array(
    z.object({
      title: z.string().min(2, 'Application title required'),
      body: z.string().min(10, 'Application body required'),
    })
  ).length(4, 'Application must contain exactly 4 points'),
  prayer: z.array(z.string().min(5)).length(2, 'Prayer must contain exactly 2 points'),
});

export type WorshipProgram = z.infer<typeof WorshipProgramSchema>;
