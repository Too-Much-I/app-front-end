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

/**
 * 등급별 이어서 하기 위치(`GET /learning/resume?level=`).
 *
 * 세 상태 모두 들어갈 위치가 있다. `READY`는 마지막으로 채점이 끝난 문항의 다음, `NO_HISTORY`는 처음 학습이라
 * Part 1 첫 문항, `END_OF_PART`는 파트를 다 끝낸 뒤의 위치다. 상태는 카드 문구를 고르는 데만 쓴다.
 */
export interface LearningResume {
  status: 'READY' | 'NO_HISTORY' | 'END_OF_PART';
  part: LearningPart;
  unitId: string;
  /** 파트 안 세트 순번(1부터). */
  unitNumber: number;
  lessonId: string;
  /** 세트 안 문항 순번(1부터). 시험지 문항 번호(`questionNumber`)와 다르다. */
  lessonNumber: number;
}

/** 문항 채점 준비 여부. `ready`이고 `lessonIds`에 그 문항이 있어야 채점할 수 있다. */
export interface LearningCapabilities {
  ready: boolean;
  lessonIds: string[];
}

/** 녹음을 올릴 서명된 S3 PUT 주소. 최대 5분 유효하다. */
export interface LearningUploadUrl {
  url: string;
  expiresAtMs: number;
  maxBytes: number;
}

/** 채점 중인 상태. HTTP 성공은 채점 완료가 아니어서 이 상태 동안 다시 조회한다. */
export type LearningSubmissionPendingStatus =
  'awaiting_audio' | 'queued' | 'transcribing' | 'grading';

/** Part 2~5 녹음 제출 하나의 채점 상태. `id`는 앱이 녹음마다 만든 UUID다. */
export type LearningSubmission =
  | { id: string; status: LearningSubmissionPendingStatus }
  | { id: string; status: 'completed'; result: LearningGradeResult }
  /** `retryable`이면 같은 녹음으로 `retry`를 부를 수 있다. 아니면 새로 녹음해야 한다. */
  | { id: string; status: 'failed'; errorCode: string; retryable: boolean }
  /** 말소리가 없었다. 새로 녹음한다. */
  | { id: string; status: 'no_speech' };
