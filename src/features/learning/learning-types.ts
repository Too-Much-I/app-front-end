import type { ExamTableContext } from '@/types/exam';

export type LearningMedia = { id: string; url: string; expiresAt: string };
export type LearningPhoto = LearningMedia & { width: number; height: number };
export type LearningLevel = 'IM3' | 'IH' | 'AL';
export type LearningStage = 'listen' | 'shadow' | 'practice';
export type LearningWordTiming = { text: string; start: number; end: number };
export type LearningSentence = {
  text: string;
  translation?: string;
  label: string;
  audio: LearningMedia;
  words: LearningWordTiming[];
};
export type LearningAnswer = {
  fullAudio?: LearningMedia;
  durationSeconds?: number;
  id: string;
  example: string;
  sentences: LearningSentence[];
};
export type LearningLesson = {
  contentVersion: string;
  id: string;
  part: number;
  questionNumber: number;
  question: string;
  questionTranslation?: string;
  passageTranslation?: string;
  answerSeconds: number;
  passage: string | null;
  photo: LearningPhoto | null;
  contextIntro: string | null;
  table: ExamTableContext | null;
  tableFocus: ExamTableContext | null;
  answers: Partial<Record<LearningLevel | 'common', LearningAnswer>>;
};
export type LearningUnit = {
  id: string;
  part: number;
  title: string;
  lessonIds: string[];
  questionNumbers: number[];
  completedLessonIds: string[];
  thumbnail: LearningPhoto | null;
};
export type LearningUnitDetail = { unit: LearningUnit; lessons: LearningLesson[] };
