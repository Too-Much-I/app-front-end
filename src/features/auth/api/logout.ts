import { getIdentityApiBaseUrl } from "@/lib/api/service-base-url";
import { serviceFetch } from "@/lib/api/transport";

/**
 * 단일 로그아웃 — 이 게스트 계정 자체를 삭제한다.
 *
 * 앱의 "모든 학습 기록 삭제"가 이 호출 하나로 성립하는 근거가 여기에 있다. 만약 이
 * 엔드포인트가 refresh token만 폐기하도록 바뀌면, 같은 installationId로 `/auth/guest`가
 * 같은 게스트를 복구해(specs/009-guest-auth-bootstrap) 삭제가 조용히 무효화된다.
 * 그때는 installationId를 새 UUID로 교체하는 경로를 함께 넣어야 한다.
 */
export async function logout(refreshToken: string): Promise<void> {
  await serviceFetch<unknown>(`${getIdentityApiBaseUrl()}/api/v1/auth/logout`, {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}
