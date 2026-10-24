/**
 * 답변 익히기(학습) 도메인 타입.
 *
 * 필드는 테스트 서버 Swagger(`api-test.to-teacher.com`, 2026-10-22 확인)의 "답변 학습" 응답을 따른다.
 * 화면이 쓰는 필드만 옮겼다. 사진·표는 아직 화면에 쓰지 않아 넣지 않았다.
 */

import type { LearningPart } from '@/features/learning/learning-level';

/** 서버가 받는 등급 값. Part 1은 등급 구분이 없어 `common` 하나다. */
export type LearningServerLevel = 'common' | 'IM3' | 'IH' | 'AL';

/** 세트(학습 카드) 안의 문항 하나. `completed`는 사용자·등급·콘텐츠 버전 기준이다. */
export interface LearningLessonRef {
  id: string;
  questionNumber: number;
  completed: boolean;
}

/** 파트 목록 응답의 세트 하나. 시험의 문항 묶음(Part 3이면 Q5~Q7)과 같다. */
export interface LearningUnitSummary {
  id: string;
  part: LearningPart;
  title: string;
  lessons: LearningLessonRef[];
}

export interface LearningWord {
  text: string;
  /** 문장 음성 시작 기준 초. */
  start: number;
  end: number;
}

/** 서명된 미디어 주소. 1시간 뒤 만료되어 `GET /media/{id}/url`로 다시 받는다. */
export interface LearningMedia {
  id: string;
  url: string;
  expiresAtMs: number;
}

/**
 * 퍼즐 조각 하나의 단어 범위. `to`도 포함한다.
 *
 * 서버가 합의대로 추가하기로 했지만(2026-10-19) 아직 응답에 없다.
 */
export interface LearningChunk {
  from: number;
  to: number;
}

export interface LearningSentence {
  text: string;
  /** 없으면 화면에 표시하지 않는다. */
  translation: string | null;
  words: LearningWord[];
  /** 모범 음성. `words[].start/end`는 이 음성의 시작 기준이다. */
  audio: LearningMedia | null;
  /** 서버가 조각을 못 만든 문장과 Part 1은 `null`이다. */
  chunks: LearningChunk[] | null;
}

/** 한 문항의 선택한 등급 모범답안과 그 문항 정보. */
export interface LearningLesson {
  id: string;
  /** 완료·제출 요청에 그대로 넘기는 콘텐츠 버전. */
  contentVersion: string;
  part: LearningPart;
  questionNumber: number;
  question: string;
  questionTranslation: string | null;
  /** Part 1 지문. 다른 파트는 `null`. */
  passage: string | null;
  sentences: LearningSentence[];
}

export interface LearningUnitDetail {
  unit: LearningUnitSummary;
  /** `unit.lessons`와 같은 순서다. */
  lessons: LearningLesson[];
}

/** 체크리스트 판정. 공식 토익스피킹 점수가 아니다. */
export type LearningVerdict = 'met' | 'not_met' | 'uncertain';

export interface LearningCriterion {
  id: string;
  label: string;
  verdict: LearningVerdict;
  feedback: string;
}

/** 채점이 끝난(`completed`) 제출의 결과. */
export interface LearningGradeResult {
  transcript: string;
  metCount: number;
  totalCount: number;
  items: LearningCriterion[];
}
