/**
 * 서버 payload `data.route` 중 앱이 여는 곳. 모의고사 리마인더(명세 2026-10-07 §5)와 기프티콘 이벤트
 * (2026-10-27 서버 합의)다. `data.type`은 보지 않는다(2026-10-27 결정). 모르는 route는 앱만 열고 이동하지 않는다.
 */
export const PUSH_OPEN_ROUTES = ['MOCK_EXAM_HOME', 'CASHBACK_EVENT_HOME'] as const;

export type PushOpenRoute = (typeof PUSH_OPEN_ROUTES)[number];

export function readPushOpenRoute(
  message: { data?: Record<string, unknown> } | null,
): PushOpenRoute | null {
  const route = message?.data?.route;
  return PUSH_OPEN_ROUTES.find((candidate) => candidate === route) ?? null;
}
