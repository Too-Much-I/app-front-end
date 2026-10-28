import { isLearningPassRequiredError } from '@/features/learning/learning-pass';
import { ApiError } from '@/lib/api/transport';

describe('isLearningPassRequiredError', () => {
  it('이용권 부족 코드면 이용권 안내로 본다', () => {
    const error = new ApiError(402, '유료 이용권이 필요합니다', 'ENTITLEMENT_INSUFFICIENT');
    expect(isLearningPassRequiredError(error)).toBe(true);
  });

  it('코드 없이 온 402도 이용권 부족으로 본다', () => {
    expect(isLearningPassRequiredError(new ApiError(402, 'Payment Required'))).toBe(true);
  });

  it('다른 코드가 붙은 402는 이용권 부족이 아니다', () => {
    expect(isLearningPassRequiredError(new ApiError(402, '철회', 'ENTITLEMENT_REVOKED'))).toBe(false);
  });

  it('확인 장애(503)와 그 밖의 실패는 이용권 부족이 아니다', () => {
    expect(isLearningPassRequiredError(new ApiError(503, '확인 장애'))).toBe(false);
    expect(isLearningPassRequiredError(new ApiError(500, '연동 오류'))).toBe(false);
    expect(isLearningPassRequiredError(new Error('network'))).toBe(false);
  });
});
