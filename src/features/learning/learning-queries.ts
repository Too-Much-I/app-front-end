import { queryOptions } from '@tanstack/react-query';

import {
  getLearningResume,
  getLearningUnitDetail,
  getLearningUnits,
} from '@/features/learning/api/learning-api';
import {
  toLearningServerLevel,
  type LearningLevel,
  type LearningPart,
} from '@/features/learning/learning-level';
import { countSentencesWithoutChunks } from '@/features/learning/learning-puzzle';
import { reportOperationalError } from '@/lib/operational-error-reporting';

const LEARNING_UNITS_QUERY_KEY = ['learning', 'units'] as const;
const LEARNING_RESUME_QUERY_KEY = ['learning', 'resume'] as const;

/**
 * 진행도(세트 목록·이어서 하기) 캐시의 보관 규칙. 디스크에 남기고(`learning-progress-cache.ts`) 완료 무효화와
 * 사용자 변경 때만 다시 받는다(2026-10-28 결정). 다른 기기에서 푼 기록과 서버 세트 추가는 그 파트·등급에서
 * 이 기기로 문항을 끝낼 때까지 반영되지 않는다 — 이용권 기간이 짧아 감수했다.
 *
 * `gcTime`도 끝없이 둔다. 화면을 떠나 메모리에서 지워지면 그 삭제가 디스크에도 반영되기 때문이다.
 */
export const LEARNING_PROGRESS_CACHE_TIMES = { staleTime: Infinity, gcTime: Infinity } as const;

/** 디스크에 남기는 진행도 캐시인지. 등급·파트와 관계없이 목록과 이어서 하기 키 전체다. */
export function isLearningProgressQueryKey(queryKey: readonly unknown[]): boolean {
  return (
    queryKey[0] === LEARNING_UNITS_QUERY_KEY[0] &&
    (queryKey[1] === LEARNING_UNITS_QUERY_KEY[1] || queryKey[1] === LEARNING_RESUME_QUERY_KEY[1])
  );
}

/**
 * 세트 목록 캐시 키. 캐시를 만들 때와 무효화할 때 모두 이 함수로 만들어 키 모양이 어긋나지 않게 한다.
 * 등급에는 서버 등급을 넣는다 — Part 1은 어느 등급에서 들어와도 `common` 하나라 같은 캐시를 쓴다.
 * 등급을 빼면 그 파트의 모든 등급 목록을 가리킨다(무효화용).
 */
export function learningUnitsQueryKey(part: LearningPart, level?: LearningLevel) {
  return level === undefined
    ? ([...LEARNING_UNITS_QUERY_KEY, part] as const)
    : ([...LEARNING_UNITS_QUERY_KEY, part, toLearningServerLevel(part, level)] as const);
}

/** 파트·등급별 세트 목록. */
export function learningUnitsQueryOptions(part: LearningPart, level: LearningLevel) {
  return queryOptions({
    queryKey: learningUnitsQueryKey(part, level),
    queryFn: ({ signal }) => getLearningUnits(part, level, signal),
    meta: { failureReport: { code: 'LEARNING_LOAD_FAILED', resource: 'units' } },
    ...LEARNING_PROGRESS_CACHE_TIMES,
  });
}

/**
 * 이어서 하기 캐시 키. 등급을 빼면 모든 등급을 가리킨다(무효화용) — Part 1 완료는 서버가 모든 등급에 반영한다.
 * 세트 목록과 같은 때(채점 completed, Part 1 완료 저장) 무효화한다(2026-10-27 결정).
 */
export function learningResumeQueryKey(level?: LearningLevel) {
  return level === undefined
    ? LEARNING_RESUME_QUERY_KEY
    : ([...LEARNING_RESUME_QUERY_KEY, level] as const);
}

/** 등급별 이어서 하기 위치. */
export function learningResumeQueryOptions(level: LearningLevel) {
  return queryOptions({
    queryKey: learningResumeQueryKey(level),
    queryFn: ({ signal }) => getLearningResume(level, signal),
    meta: { failureReport: { code: 'LEARNING_LOAD_FAILED', resource: 'resume' } },
    ...LEARNING_PROGRESS_CACHE_TIMES,
  });
}

/**
 * 세트 상세. 퍼즐·쉐도잉·채점 세 화면이 같은 문항을 각자 읽어서, 캐시로 한 번만 받게 한다.
 *
 * 콘텐츠는 학습 중에 바뀌지 않으니 화면을 오가는 동안 다시 받지 않는다. 문장 음성 주소는 1시간 뒤 만료되지만
 * 재생 직전에 따로 갱신하므로(2026-10-23 결정) 상세를 다시 받을 이유가 되지 않는다.
 */
export function learningUnitDetailQueryOptions(
  unitId: string,
  part: LearningPart,
  level: LearningLevel,
) {
  return queryOptions({
    queryKey: ['learning', 'detail', unitId, toLearningServerLevel(part, level)],
    queryFn: async ({ signal }) => {
      const detail = await getLearningUnitDetail(unitId, part, level, signal);
      // 조각이 빠진 문장도 세 단어로 잘라 퍼즐은 그대로 할 수 있어서, 화면은 막지 않고 보고만 한다.
      // 상세는 캐시에 오래 남아 받을 때 한 번만 보고된다.
      const missingSentences = countSentencesWithoutChunks(detail.lessons);
      if (missingSentences > 0) {
        reportOperationalError({
          code: 'LEARNING_CHUNKS_MISSING',
          part,
          unitId,
          missingSentences,
        });
      }
      return detail;
    },
    meta: { failureReport: { code: 'LEARNING_LOAD_FAILED', resource: 'detail' } },
    staleTime: Infinity,
  });
}
