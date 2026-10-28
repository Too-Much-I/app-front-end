import { ApiError } from '@/lib/api/transport';

/**
 * 세트 상세(`GET /learning/units/{id}`)가 이용권 부족으로 거절됐는지(2026-10-28 결정).
 *
 * 서버는 파트별 첫 세트를 무료로 열고 그 밖의 세트에서 유료권을 조회한다(Swagger). 어느 세트가 무료인지,
 * 몇 번째 요청인지는 앱이 세지 않고 이 거절만 본다 — 다 끝낸 파트는 첫 문항으로 돌아가 앱은 처음 여는 것과
 * 다시 도는 것을 구분하지 못한다. Swagger 응답 목록에는 402가 빠져 있어, 시험 생성과 같이 코드 없는 402도
 * 이용권 부족으로 본다. 확인 장애(503)는 여기 들지 않는다.
 */
export function isLearningPassRequiredError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.code === 'ENTITLEMENT_INSUFFICIENT' || error.status === 402)
  );
}
