import type { User } from "@react-native-firebase/auth";

export type FirebaseLoginProvider = "google" | "apple" | "kakao";

export type FirebaseAuthFailure = { kind: "failed" } & (
  | { reason: "connection" | "service-unavailable"; nextAction: "retry" }
  | { reason: "reauthentication-required"; nextAction: "sign-in-again" }
  | { reason: "provider-unavailable" | "unexpected"; nextAction: "get-help" }
);

export type FirebaseAuthFailureReason = FirebaseAuthFailure["reason"];

export type FirebaseProofResult =
  | { kind: "proof-ready"; uid: string; firebaseIdToken: string }
  | { kind: "cancelled" }
  | { kind: "ignored"; reason: "busy" | "no-retry" }
  | FirebaseAuthFailure;

/** 화면에 공개하는 작업 상태. Firebase User·Token은 포함하지 않는다. */
export type FirebaseAuthOperationState =
  | { status: "idle" }
  | {
      status: "running";
      provider: FirebaseLoginProvider;
      step: "provider-sign-in" | "get-id-token";
    }
  | { status: "cancelling" }
  | {
      status: "failed";
      provider: FirebaseLoginProvider;
      failure: FirebaseAuthFailure;
    };

/** signal은 후속 호출을 막는다. 네이티브 작업의 즉시 중단을 보장하지 않는다. */
export interface FirebaseAuthSdk {
  signInProvider: (
    provider: FirebaseLoginProvider,
    signal: AbortSignal,
  ) => Promise<{ kind: "signed-in"; user: User } | { kind: "cancelled" }>;
  getIdToken: (user: User, forceRefresh: boolean) => Promise<string>;
  getCurrentUid: () => string | null;
}

/** 원문 SDK 오류·인증 자료를 외부 상태나 로그로 전달하지 않는다. */
export class FirebaseAuthenticationError extends Error {
  constructor(public readonly reason: FirebaseAuthFailureReason) {
    super("Firebase 본인 인증을 완료하지 못했습니다.");
    this.name = "FirebaseAuthenticationError";
  }
}
