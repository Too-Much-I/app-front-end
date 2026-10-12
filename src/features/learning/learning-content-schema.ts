import { z } from 'zod';

const identifier = z.string().min(1).max(160);
export const learningMediaSchema = z.object({
  id: identifier,
  url: z.url({ protocol: /^https$/ }),
  expiresAt: z.iso.datetime({ offset: true }),
});
const photoSchema = learningMediaSchema.extend({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const tableSchema = z.object({
  tableType: z.string(),
  title: z.string(),
  subtitles: z.array(z.string()),
  metadata: z.array(z.object({ key: z.string(), label: z.string(), value: scalar })),
  columns: z.array(z.object({ key: z.string(), label: z.string(), valueType: z.string() })),
  items: z.array(
    z.object({
      cells: z.record(z.string(), scalar),
      status: z.string(),
      statusNote: z.string().nullable(),
      strikeThrough: z.boolean(),
    }),
  ),
  notes: z.array(z.object({ scope: z.string(), text: z.string() })),
});
const sentenceSchema = z
  .object({
    text: z.string().min(1),
    translation: z.string().optional(),
    label: z.string(),
    audio: learningMediaSchema,
    words: z
      .array(
        z.object({
          text: z.string(),
          start: z.number().nonnegative(),
          end: z.number().nonnegative(),
        }),
      )
      .min(1),
  })
  .refine(
    (s) =>
      s.words.map((w) => w.text).join(' ') === s.text &&
      s.words.every((w, i) => w.end >= w.start && (i === 0 || w.start >= s.words[i - 1].start)),
    'Invalid word timing',
  );
const answerSchema = z
  .object({
    id: identifier,
    example: z.string(),
    fullAudio: learningMediaSchema.optional(),
    durationSeconds: z.number().positive().optional(),
    sentences: z.array(sentenceSchema).min(1),
  })
  .refine(
    (a) => a.sentences.map((s) => s.text).join(' ') === a.example,
    'Sentence text differs from answer',
  );
export const learningUnitSchema = z
  .object({
    id: identifier,
    part: z.number().int().min(1).max(5),
    title: z.string().min(1),
    thumbnail: photoSchema.nullable(),
    lessons: z
      .array(
        z.object({
          id: identifier,
          questionNumber: z.number().int().min(1).max(11),
          completed: z.boolean(),
        }),
      )
      .min(1)
      .max(3),
  })
  .refine(
    (u) =>
      u.lessons.length === (u.part === 3 || u.part === 4 ? 3 : 1) &&
      new Set(u.lessons.map((l) => l.id)).size === u.lessons.length,
    'Invalid unit lessons',
  );
export const learningCatalogSchema = z
  .object({
    part: z.number().int().min(1).max(5),
    level: z.enum(['common', 'IM3', 'IH', 'AL']),
    units: z.array(learningUnitSchema).max(100),
  })
  .refine(
    (c) =>
      c.units.every((u) => u.part === c.part) &&
      new Set(c.units.map((u) => u.id)).size === c.units.length,
    'Invalid catalog',
  );
export const learningDetailSchema = z
  .object({
    unit: learningUnitSchema,
    lessons: z
      .array(
        z.object({
          id: identifier,
          contentVersion: identifier,
          part: z.number().int().min(1).max(5),
          questionNumber: z.number().int().min(1).max(11),
          question: z.string(),
          questionTranslation: z.string().optional(),
          passageTranslation: z.string().optional(),
          answerSeconds: z.number().int().min(15).max(60),
          passage: z.string().nullable(),
          photo: photoSchema.nullable(),
          contextIntro: z.string().nullable(),
          table: tableSchema.nullable(),
          tableFocus: tableSchema.nullable(),
          level: z.enum(['common', 'IM3', 'IH', 'AL']),
          answer: answerSchema,
        }),
      )
      .min(1)
      .max(3),
  })
  .refine(
    (d) =>
      d.lessons.length === d.unit.lessons.length &&
      d.lessons.every(
        (l, i) =>
          l.id === d.unit.lessons[i].id &&
          l.questionNumber === d.unit.lessons[i].questionNumber &&
          l.part === d.unit.part &&
          (l.part !== 1 || (l.level === 'common' && !!l.passage && !!l.answer.fullAudio)) &&
          (l.part !== 2 || !!l.photo) &&
          (l.part !== 4 || (!!l.table && !!l.tableFocus)),
      ),
    'Invalid lesson detail',
  );
