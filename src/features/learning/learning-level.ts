/**
 * 학습 콘텐츠의 등급 값.
 *
 * 화면에는 Easy·Medium·Hard로 보여 주지만, 화면 사이로 넘기고 서버에 보내는 값은 서버 파라미터
 * 그대로다(2026-10-19 결정). 표시 이름을 값으로 쓰면 요청을 만들 때마다 다시 바꿔야 하고,
 * 그 변환이 한 곳이라도 빠지면 서버가 모르는 등급을 받는다.
 *
 * Part 1은 서버에서 `common` 하나뿐이다. 그 변환은 요청을 만드는 쪽이 맡고 여기 값에는 넣지 않는다 —
 * 사용자가 고르는 등급이 아니기 때문이다.
 */
export const LEARNING_LEVELS = ['IM3', 'IH', 'AL'] as const;

export type LearningLevel = (typeof LEARNING_LEVELS)[number];

/** 토익 스피킹 파트 번호. 학습은 파트 단위로 들어간다. */
export type LearningPart = 1 | 2 | 3 | 4 | 5;
