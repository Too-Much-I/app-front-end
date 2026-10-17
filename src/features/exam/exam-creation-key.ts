import * as Crypto from 'expo-crypto';

/**
 * 시험 생성(`POST /exams`)의 Idempotency-Key.
 *
 * 결론이 날 때까지 같은 키를 쓴다(2026-10-17 결정). 응답만 끊긴 경우 새 키로 다시 보내면 서버는 처음 보는
 * 요청으로 받는다 — 응시권을 잡아 둔 단계였으면 402가, 세션 확정 뒤였으면 세션이 하나 더 생긴다. 같은 키면
 * 아까 만든 시험을 돌려준다.
 * 화면을 떠났다 돌아와도 같은 시도로 보도록 앱이 켜져 있는 동안 모듈이 들고 있다. 계정이 바뀔 수 있는
 * 로그인 화면에서는 비운다 — 다른 계정의 키를 보내지 않는다.
 */
let pendingKey: string | null = null;

/** 결론 나지 않은 키가 있으면 그대로, 없으면 새로 만든다. 서버 형식은 소문자 UUID v4. */
export function takeExamCreationKey(): string {
  pendingKey ??= Crypto.randomUUID().toLowerCase();
  return pendingKey;
}

/** 시험이 만들어졌거나 다시 보내도 소용없는 거절을 받았다. 다음 시도는 새 키로 한다. */
export function settleExamCreationKey(key: string): void {
  if (pendingKey === key) pendingKey = null;
}

/** 로그인 화면 상태가 되면 비운다. */
export function forgetExamCreationKey(): void {
  pendingKey = null;
}
