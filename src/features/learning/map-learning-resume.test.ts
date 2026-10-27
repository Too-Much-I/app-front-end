import { learningResumeSchema, mapLearningResume } from '@/features/learning/map-learning-resume';

/** Swagger 예시(`LearningRecentResume`, 2026-10-27). */
const SWAGGER_EXAMPLE = {
  status: 'READY',
  level: 'IH',
  part: 3,
  unitId: 'unit-3-2',
  unitNumber: 2,
  lessonId: 'lesson-3-2-3',
  lessonNumber: 3,
  questionNumber: 7,
};

function parse(raw: unknown) {
  return mapLearningResume(learningResumeSchema.parse(raw));
}

describe('mapLearningResume', () => {
  it('위치를 옮기고 보낸 등급과 시험지 문항 번호는 버린다', () => {
    expect(parse(SWAGGER_EXAMPLE)).toEqual({
      status: 'READY',
      part: 3,
      unitId: 'unit-3-2',
      unitNumber: 2,
      lessonId: 'lesson-3-2-3',
      lessonNumber: 3,
    });
  });

  it('NO_HISTORY도 위치가 있어 그대로 옮긴다', () => {
    expect(parse({ ...SWAGGER_EXAMPLE, status: 'NO_HISTORY', part: 1 }).status).toBe('NO_HISTORY');
  });

  it('part를 보냈을 때 오는 옛 모양은 받지 않는다', () => {
    expect(() => parse({ unitId: 'unit-3-1', allCompleted: false })).toThrow();
  });
});
