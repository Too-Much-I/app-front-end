import {
  learningSubmissionSchema,
  mapLearningSubmission,
} from '@/features/learning/map-learning-submission';

const ID = 'd11aa316-35be-4e49-b681-19a35d2c7bce';

function parse(raw: unknown) {
  return mapLearningSubmission(learningSubmissionSchema.parse(raw));
}

describe('mapLearningSubmission', () => {
  it('채점 중 상태는 결과 없이 상태만 옮긴다', () => {
    expect(parse({ id: ID, status: 'transcribing', result: null, error: null })).toEqual({
      id: ID,
      status: 'transcribing',
    });
  });

  it('completed는 체크리스트 결과를 옮기고 probability는 버린다', () => {
    const submission = parse({
      id: ID,
      status: 'completed',
      result: {
        checklistVersion: 'v1',
        transcript: 'I like it.',
        metCount: 1,
        totalCount: 2,
        items: [{ id: 'a', label: '이유', verdict: 'met', probability: 0.9, feedback: '좋아요' }],
      },
    });
    expect(submission).toEqual({
      id: ID,
      status: 'completed',
      result: {
        transcript: 'I like it.',
        metCount: 1,
        totalCount: 2,
        items: [{ id: 'a', label: '이유', verdict: 'met', feedback: '좋아요' }],
      },
    });
  });

  it('failed는 서버 오류 코드와 재시도 가능 여부만 옮긴다', () => {
    expect(
      parse({
        id: ID,
        status: 'failed',
        error: { code: 'STT_FAILED', message: '다시 시도해 주세요', retryable: true },
      }),
    ).toEqual({ id: ID, status: 'failed', errorCode: 'STT_FAILED', retryable: true });
  });

  it('completed인데 result가 없으면 응답 형식 오류다', () => {
    expect(() => parse({ id: ID, status: 'completed', result: null })).toThrow();
  });

  it('failed인데 error가 없으면 응답 형식 오류다', () => {
    expect(() => parse({ id: ID, status: 'failed' })).toThrow();
  });
});
