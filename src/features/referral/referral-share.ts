/**
 * 웹 초대 페이지. 주소는 빌드와 상관없이 고정이다(2026-10-29 결정) — `EXPO_PUBLIC_WEB_BASE_URL`을 쓰면 테스트
 * 빌드에서 테스트 웹 주소가 친구에게 간다. 웹이 utm을 붙인 페이지로 옮기며 코드를 넘겨 화면에 띄운다.
 */
const INVITE_PAGE_URL = 'https://to-teacher.com/invite/';

export function buildReferralInviteUrl(code: string): string {
  return `${INVITE_PAGE_URL}${encodeURIComponent(code)}`;
}

/**
 * 기본 공유 창(`Share`)으로 보낼 글. 링크 미리보기는 받는 앱이 웹 페이지의 OG로 만든다. 친구는 앱을 깔고 가입
 * 화면에 코드를 직접 넣는다 — 자동 채우기(지연 딥링크)는 하지 않는다.
 */
export function buildReferralShareMessage(code: string): string {
  return [
    '토선생에서 토익스피킹 모의고사 같이 풀어요!',
    `가입할 때 추천 코드 ${code}를 넣으면 우리 둘 다 무료 모의고사권을 1장씩 받아요.`,
    buildReferralInviteUrl(code),
  ].join('\n');
}
