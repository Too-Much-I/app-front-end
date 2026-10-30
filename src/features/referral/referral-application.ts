import * as Crypto from 'expo-crypto';

import type { ReferralApplicationRequest } from '@/features/referral/api/apply-referral-code';
import type { PendingReferral } from '@/features/referral/pending-referral-storage';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

/** 다시 보내도 같은 답이라 저장한 코드를 지우고 사용자에게 알리는 거절. */
export type ReferralRejection = 'self-referral' | 'code-unavailable' | 'already-applied';

/**
 * 적용 응답 하나에 대한 결정(2026-10-29 D3 결정).
 *
 * - `applied`: 지우고 알린다.
 * - `rejected`: 지우고 알린다. 다시 입력할 기회는 주지 않는다(D5).
 * - `dropped`: 지우고 알리지 않는다. 403(Guest·탈퇴)과, 앱이 잘못 보내 같은 요청을 반복하면 안 되는 오류다.
 * - `kept`: 남기고 알리지 않는다. 다음 실행에 다시 보낸다.
 */
export type ReferralDecision =
  | { kind: 'applied' }
  | { kind: 'rejected'; reason: ReferralRejection }
  | { kind: 'dropped'; reason: 'forbidden' | 'unexpected' }
  | { kind: 'kept'; reason: ReferralKeptReason };

/**
 * - `retry-later`: 409 결제용 ID·429·503·응답 없음·200 응답 형식 오류. 서버가 나중에 받아 줄 수 있다.
 * - `unauthenticated`: 401. `billingFetch`는 쓰기 요청이라 401을 재시도하지 않는다 — 다음 실행에 로그인을
 *   복원한 뒤 보낸다.
 * - `not-found`: 404. 미배포·기능 꺼짐·경로 오류를 모두 뜻해 종료로 볼 수 없다. 서버에 종료 전용 code를
 *   요청했고 답을 받기 전까지 남겨 둔다.
 * - `purchase-account`: 결제용 ID를 받지 못해 보내지 않았다.
 */
export type ReferralKeptReason =
  'retry-later' | 'unauthenticated' | 'not-found' | 'purchase-account';

/** 오류 분기는 message가 아니라 code로 한다(추천 코드 명세). code가 없으면 status로 본다. */
export function decideReferralFailure(error: unknown): ReferralDecision {
  if (error instanceof TransportConnectionError) return { kind: 'kept', reason: 'retry-later' };
  if (!(error instanceof ApiError)) return { kind: 'kept', reason: 'retry-later' };
  switch (error.code) {
    case 'SELF_REFERRAL_NOT_ALLOWED':
      return { kind: 'rejected', reason: 'self-referral' };
    case 'REFERRAL_CODE_UNAVAILABLE':
      return { kind: 'rejected', reason: 'code-unavailable' };
    case 'REFERRAL_ALREADY_APPLIED':
      return { kind: 'rejected', reason: 'already-applied' };
    case 'PURCHASE_ACCOUNT_REQUIRED':
      return { kind: 'kept', reason: 'retry-later' };
    // 서버는 처리했는데 우리가 응답을 읽지 못했다. 새 키로 다시 보내도 같은 200이 온다.
    case 'API_RESPONSE_VALIDATION_FAILED':
      return { kind: 'kept', reason: 'retry-later' };
  }
  if (error.status === 401) return { kind: 'kept', reason: 'unauthenticated' };
  if (error.status === 403) return { kind: 'dropped', reason: 'forbidden' };
  if (error.status === 404) return { kind: 'kept', reason: 'not-found' };
  if (error.status === 429 || error.status >= 500) return { kind: 'kept', reason: 'retry-later' };
  // 400 형식 오류·409 키 충돌·413·415 등. 같은 요청을 다시 보내도 소용없다.
  return { kind: 'dropped', reason: 'unexpected' };
}

/** 홈이 받는 결과. `none`이면 아무것도 띄우지 않는다. */
export type ReferralApplyOutcome =
  { kind: 'none' } | { kind: 'applied' } | { kind: 'rejected'; reason: ReferralRejection };

const NONE: ReferralApplyOutcome = { kind: 'none' };

function toOutcome(decision: ReferralDecision): ReferralApplyOutcome {
  switch (decision.kind) {
    case 'applied':
      return { kind: 'applied' };
    case 'rejected':
      return { kind: 'rejected', reason: decision.reason };
    case 'dropped':
    case 'kept':
      return NONE;
  }
}

type ReferralApplicationDependencies = {
  request: (request: ReferralApplicationRequest) => Promise<unknown>;
  readPending: () => Promise<PendingReferral | null>;
  writePending: (pending: PendingReferral | null) => Promise<void>;
  /** 지금 로그인한 Firebase 사용자. 저장한 `uid`와 다르면 보내지 않는다. */
  getCurrentUid: () => string | null;
  /** 적용 API는 결제용 ID(purchase-account)가 있어야 받는다. 실패하면 던진다. */
  preparePurchaseAccount: () => Promise<unknown>;
  /** 요청을 보낸 뒤의 결정. 분석·오류 보고를 붙인다. 던지지 않아야 한다. */
  onDecided?: (decision: ReferralDecision, cause?: unknown) => void;
};

/**
 * 가입 때 입력한 추천 코드를 가입 뒤에 적용한다(2026-10-29 D2·D4·D9 결정).
 *
 * - 가입이 끝나면 `remember`가 uid와 코드를 기기에 둔다. 키는 두지 않는다.
 * - 홈이 보이면 `applyPending`. 결제용 ID를 기다린 뒤 보낸다. 앱이 켜져 있는 동안 한 번만 보낸다 — 응답 전에
 *   홈이 다시 보이거나 탭을 오가도 중복 요청·429가 나지 않게 한다. 남은 코드는 다음 실행에 보낸다.
 * - 로그인 화면에 오면 `clear`. 로그아웃·탈퇴로 계정이 바뀔 수 있어 남은 코드를 지운다.
 *
 * 저장소 읽기·쓰기는 한 줄로 세운다. 로그인 화면의 지우기가 늦게 끝나 방금 가입한 코드를 지우지 않게 한다.
 */
export function createReferralApplication(dependencies: ReferralApplicationDependencies) {
  let storageTail: Promise<unknown> = Promise.resolve();
  /** 로그인 화면에 오면 올라간다. 그 전에 시작한 적용은 저장소를 건드리지 않는다. */
  let generation = 0;
  let attempted = false;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = storageTail.then(task);
    storageTail = run.catch(() => undefined);
    return run;
  }

  /** 지우기는 시작한 계정이 그대로일 때만 한다. 실패하면 다음 실행에 한 번 더 보낸다 — 서버가 같은 답을 준다. */
  function forget(startGeneration: number): Promise<void> {
    return enqueue(async () => {
      if (startGeneration === generation) await dependencies.writePending(null);
    }).catch(() => undefined);
  }

  /** 가입이 끝났을 때. 저장에 실패하면 이번 실행 동안만 적용 기회를 잃는다. 던지지 않는다. */
  function remember(pending: PendingReferral): Promise<void> {
    return enqueue(() => dependencies.writePending(pending)).catch(() => undefined);
  }

  async function applyPending(): Promise<ReferralApplyOutcome> {
    if (attempted) return NONE;
    attempted = true;
    const startGeneration = generation;
    const pending = await enqueue(dependencies.readPending).catch(() => null);
    if (!pending) return NONE;
    const uid = dependencies.getCurrentUid();
    // 사용자를 아직 모르면 판단을 미룬다. 다른 사용자면 이 계정의 코드가 아니다.
    if (!uid) return NONE;
    if (uid !== pending.uid) {
      await forget(startGeneration);
      return NONE;
    }

    let decision: ReferralDecision;
    let cause: unknown;
    try {
      await dependencies.preparePurchaseAccount();
      if (startGeneration !== generation) return NONE;
      try {
        await dependencies.request({
          code: pending.code,
          idempotencyKey: Crypto.randomUUID().toLowerCase(),
        });
        decision = { kind: 'applied' };
      } catch (error) {
        decision = decideReferralFailure(error);
        cause = error;
      }
    } catch (error) {
      decision = { kind: 'kept', reason: 'purchase-account' };
      cause = error;
    }
    if (startGeneration !== generation) return NONE;
    dependencies.onDecided?.(decision, cause);
    if (decision.kind !== 'kept') await forget(startGeneration);
    return toOutcome(decision);
  }

  /** 로그인 화면에 오면 부른다. 진행 중인 적용의 결과를 버리고, 다음 계정이 이번 실행에 다시 보낼 수 있게 한다. */
  function clear(): Promise<void> {
    generation += 1;
    attempted = false;
    return enqueue(() => dependencies.writePending(null)).catch(() => undefined);
  }

  return { remember, applyPending, clear };
}
