import { z } from 'zod';

import {
  toLearningServerLevel,
  type LearningLevel,
  type LearningPart,
} from '@/features/learning/learning-level';
import { learningGradeSchema, mapLearningGrade } from '@/features/learning/map-learning-grade';
import learningMock from '@/features/learning/mock/learning-mock.json';
import type {
  LearningGradeResult,
  LearningServerLevel,
  LearningUnitSummary,
} from '@/types/learning';

/**
 * 아직 서버에 붙이지 않은 Part 2~5 채점 자리.
 *
 * 목록·상세는 2026-10-23부터 실제 API를 쓴다. 채점(제출 → 업로드 → 접수 → 조회)은 다음 작업 단위라, 채점
 * 결과는 목데이터 한 벌을 돌려주고 완료 기록은 메모리에만 둔다. 서버는 채점이 끝나야 Part 2~5를 완료로
 * 저장하므로, 목 채점을 마친 문항은 서버 목록 위에 완료로 덧씌워 보여 준다. 앱을 다시 켜면 사라진다.
 */

const mockSchema = z.object({
  gradedJob: z.object({ result: learningGradeSchema }),
});

const completedLessonKeys = new Set<string>();

function completionKey(lessonId: string, serverLevel: LearningServerLevel) {
  return `${lessonId}|${serverLevel}`;
}

/** 서버 목록에 목 채점 완료 기록을 덧씌운다. */
export function withMockLearningCompletion(
  units: readonly LearningUnitSummary[],
  part: LearningPart,
  level: LearningLevel,
): LearningUnitSummary[] {
  const serverLevel = toLearningServerLevel(part, level);
  return units.map((unit) => ({
    ...unit,
    lessons: unit.lessons.map((lesson) => ({
      ...lesson,
      completed: lesson.completed || completedLessonKeys.has(completionKey(lesson.id, serverLevel)),
    })),
  }));
}

/**
 * 채점이 끝난 제출의 결과 자리. 목데이터에는 채점 결과가 한 벌뿐이라 문항과 상관없이 같은 값을 준다.
 * 실제로는 제출 생성 → 업로드 → 접수 → 상태 조회를 거친다.
 */
export function getMockLearningGrade(): LearningGradeResult {
  return mapLearningGrade(mockSchema.parse(learningMock).gradedJob.result);
}

/** Part 2~5 문항 완료 자리. 서버는 채점 완료 때 직접 저장한다. */
export function markMockLearningLessonCompleted(
  lessonId: string,
  part: LearningPart,
  level: LearningLevel,
) {
  completedLessonKeys.add(completionKey(lessonId, toLearningServerLevel(part, level)));
}
