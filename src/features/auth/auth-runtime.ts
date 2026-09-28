import { createAuthConsentController } from "@/features/auth/auth-consent-controller";
import { createAuthCoordinator } from "@/features/auth/auth-coordinator";
import { createSessionController } from "@/features/auth/session-controller";
import { createAuthenticatedApiClient } from "@/lib/api/authenticated-client";

/**
 * 전환용 조립 함수. 현재 App에서는 호출하지 않는다.
 * 전환 시 App과 공용 API가 이 인스턴스를 공유해야 한다.
 * 생성은 저장소·네트워크를 실행하지 않고 bootstrap이 복원을 시작한다.
 */
export function createAuthRuntime(options: { replaySupported: boolean }) {
  const session = createSessionController(options);
  const consent = createAuthConsentController(session);
  const coordinator = createAuthCoordinator(session, consent);
  const api = createAuthenticatedApiClient(session);
  const dispose = session.subscribeRestoration(coordinator.handleSessionResult);

  return { session, consent, coordinator, api, dispose };
}
