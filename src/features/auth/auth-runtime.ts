import { AppState } from "react-native";
import { exchangeFirebaseProof } from "@/features/auth/api/exchange-firebase-proof";
import { prepareGuestEnrollment } from "@/features/auth/api/prepare-guest-enrollment";
import { createFirebaseAuthController } from "@/features/auth/firebase-auth-controller";
import type { FirebaseAuthSdk } from "@/features/auth/firebase-auth-types";

import { createAuthConsentController } from "@/features/auth/auth-consent-controller";
import { createAuthCoordinator } from "@/features/auth/auth-coordinator";
import { createSessionController } from "@/features/auth/session-controller";
import { createAuthenticatedApiClient } from "@/lib/api/authenticated-client";

/**
 * 전환용 조립 함수. 현재 App에서는 호출하지 않는다.
 * 전환 시 App과 공용 API가 이 인스턴스를 공유해야 한다.
 * 생성은 저장소·네트워크를 실행하지 않고 bootstrap이 복원을 시작한다.
 * 앱 활성화 리스너를 등록하므로 소유자가 dispose를 호출한다.
 */
export function createAuthRuntime(options: {
  replaySupported: boolean;
  firebaseSdk: FirebaseAuthSdk;
}) {
  const session = createSessionController(options);
  const consent = createAuthConsentController(session);
  const firebase = createFirebaseAuthController(options.firebaseSdk);
  const coordinator = createAuthCoordinator(session, consent, {
    firebase,
    session,
    exchange: exchangeFirebaseProof,
    prepare: prepareGuestEnrollment,
  });
  const api = createAuthenticatedApiClient(session);
  const unsubscribe = session.subscribeRestoration(
    coordinator.handleSessionResult,
  );
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") session.retryPersistence();
  });
  const dispose = () => {
    coordinator.dispose();
    unsubscribe();
    appState.remove();
    session.dispose();
  };

  return { session, consent, coordinator, api, dispose };
}
