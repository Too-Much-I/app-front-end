import { z } from 'zod';

import { learningMediaSchema, mapLearningMedia } from '@/features/learning/map-learning-media';
import { learningUnitSchema, mapLearningUnit } from '@/features/learning/map-learning-unit';
import type { LearningSentence, LearningUnitDetail } from '@/types/learning';

const learningSentenceSchema = z.object({
  /** 서버가 `words[].text`를 공백 하나로 이은 값과 같다고 보장한다. 다르면 서버가 503을 준다. */
  text: z.string(),
  translation: z.string().nullish(),
  words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })),
  audio: learningMediaSchema.nullish(),
  /**
   * 퍼즐 조각 경계. 서버와 합의한 형태(`{from, to}`, `to` 포함)대로 온다고 보고 받는다(2026-10-23 결정).
   * 아직 서버 응답에는 없어서 선택 필드다. 없으면 조각을 못 만든 문장과 같게 `null`로 둔다.
   */
  chunks: z.array(z.object({ from: z.number().int(), to: z.number().int() })).nullish(),
});

/**
 * `GET /api/v1/learning/units/{id}?level=` 응답 `result`의 와이어 모양.
 *
 * 사진·표는 아직 화면에 쓰지 않아 선언하지 않았다. 음성은 문장별 `audio`만 쓴다.
 */
export const learningUnitDetailSchema = z.object({
  unit: learningUnitSchema,
  lessons: z.array(
    z.object({
      id: z.string(),
      contentVersion: z.string(),
      part: learningUnitSchema.shape.part,
      questionNumber: z.number().int(),
      question: z.string(),
      questionTranslation: z.string().nullish(),
      passage: z.string().nullish(),
      answer: z.object({ sentences: z.array(learningSentenceSchema) }),
    }),
  ),
});

function mapLearningSentence(raw: z.infer<typeof learningSentenceSchema>): LearningSentence {
  return {
    text: raw.text,
    translation: raw.translation ?? null,
    words: raw.words.map((word) => ({ text: word.text, start: word.start, end: word.end })),
    audio: raw.audio ? mapLearningMedia(raw.audio) : null,
    chunks: raw.chunks?.map((chunk) => ({ from: chunk.from, to: chunk.to })) ?? null,
  };
}

export function mapLearningUnitDetail(
  raw: z.infer<typeof learningUnitDetailSchema>,
): LearningUnitDetail {
  return {
    unit: mapLearningUnit(raw.unit),
    lessons: raw.lessons.map((lesson) => ({
      id: lesson.id,
      contentVersion: lesson.contentVersion,
      part: lesson.part,
      questionNumber: lesson.questionNumber,
      question: lesson.question,
      questionTranslation: lesson.questionTranslation ?? null,
      passage: lesson.passage ?? null,
      sentences: lesson.answer.sentences.map(mapLearningSentence),
    })),
  };
}
