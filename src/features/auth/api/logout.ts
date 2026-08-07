import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

/**
 * 회원 탈퇴 — 이 게스트 계정 자체를 삭제한다.
 *
 * 앱의 "모든 학습 기록 삭제"가 이 호출 하나로 성립하는 근거가 여기에 있다. 만약 이
 * 엔드포인트가 refresh token만 폐기하도록 바뀌면, 같은 installationId로 `/auth/guest`가
 * 같은 게스트를 복구해(specs/009-guest-auth-bootstrap) 삭제가 조용히 무효화된다.
 * 그때는 installationId를 새 UUID로 교체하는 경로를 함께 넣어야 한다.
 *
 * `/auth/logout`과 달리 `Authorization` 헤더를 요구한다. 두 토큰은 **같은 세션에서**
 * 꺼내야 한다 — 회전 직후 낡은 access token과 새 refresh token을 섞어 보내면 서버가
 * 짝이 맞지 않는 요청으로 거절한다.
 *
 * 명세상 `password`는 LOCAL 사용자만 필수다. 이 앱은 게스트 계정만 다루므로 보내지 않는다.
 */
export async function logout(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/users/withdraw`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken }),
  });
}
