/**
 * ISO 8601 UTC 시각을 앱 시계 기준 ms로 옮긴다.
 *
 * 기기 시계가 틀어져 있으면 만료 판정도 함께 틀어지지만, 업로드 만료의 최종 판정은
 * S3와 서버가 한다. 여기 값은 "더 시도해볼 가치가 있는가"를 재는 예산일 뿐이다.
 *
 * attempt 매퍼와 업로드 URL 매퍼가 같은 규칙으로 읽어야 해서 한 곳에 둔다 —
 * 둘 중 하나만 파싱 실패를 다르게 다루면 제출 예산이 두 값으로 갈린다.
 */
export function toEpochMs(isoTime: string): number {
  const parsed = Date.parse(isoTime);
  return Number.isNaN(parsed) ? 0 : parsed;
}
