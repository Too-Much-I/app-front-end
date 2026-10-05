import { createStore } from 'zustand/vanilla';

import type { GuestMergeResult } from '@/features/auth/api/submit-guest-merge';
import { AUTH_RECOVERY_MESSAGES, classifyAuthRecovery } from '@/features/auth/auth-recovery';
import type { FirebaseProofResult } from '@/features/auth/firebase-auth-types';
import type {
  IdentityEnrollment,
  IdentityExchangeResult,
  IdentityGuestPreparationResult,
} from '@/features/auth/identity-login-types';
import type { RequestAuthSnapshot } from '@/features/auth/types';
import { ApiError, TransportConnectionError } from '@/lib/api/transport';

// 서버 표가 처리를 정해 둔 5xx. 나머지 5xx는 서버가 병합했는지 알 수 없다(승격 흐름과 같은 기준).
const DEFINED_SERVER_ERROR_CODES: readonly string[] = [
  'FIREBASE_UNAVAILABLE',
  'SESSION_SECURITY_UNAVAILABLE',
];

/**
 * retry: 같은 작업을 다시 시도 / retry-or-help: 다시 시도와 도움 요청을 함께 보인다
 * continue-signup: 대상 계정이 사라져 승격(새 가입)으로 이어간다 / get-help: 도움 요청
 * sign-in-again: SNS 로그인부터 다시 / exit: 병합을 멈추고 로그인 화면으로
 */
export type GuestMergeFailureAction =
  'retry' | 'retry-or-help' | 'continue-signup' | 'get-help' | 'sign-in-again' | 'exit';

export type GuestMergeFailureNotice = {
  title: string;
  message: string;
  nextAction: GuestMergeFailureAction;
};

export type GuestMergeFlowState =
  | { status: 'confirming' }
  | { status: 'submitting' }
  | ({ status: 'failed' } & GuestMergeFailureNotice);

/** 2026-10-02~05 사용자가 승인한 문구. 한 문장짜리 제목과 그 뒤 안내로 나눴다. */
const GUEST_MERGE_NOTICES = {
  outcomeUnknown: {
    title: '학습 기록을 합쳤는지 확인하지 못했어요',
    message: '잠시 후 다시 시도해 주세요.',
    nextAction: 'retry',
  },
  outcomeUnknownRepeated: {
    title: '학습 기록을 합쳤는지 확인하지 못했어요',
    message: '문제가 계속되면 도움을 요청해 주세요.',
    nextAction: 'retry-or-help',
  },
  targetWithdrawn: {
    title: '이 SNS 계정은 탈퇴한 계정이에요',
    message: '이 계정으로 새로 가입하면 지금까지의 학습 기록을 그대로 이어서 쓸 수 있어요.',
    nextAction: 'continue-signup',
  },
  targetSuspended: {
    title: '이 SNS 계정은 지금 이용할 수 없어요',
    message: '계정을 다시 이용하려면 도움을 요청해 주세요.',
    nextAction: 'get-help',
  },
  targetConflict: {
    title: '계정 상태를 확인하지 못했어요',
    message: 'SNS 로그인부터 다시 진행해 주세요.',
    nextAction: 'sign-in-again',
  },
  targetConflictRepeated: {
    title: '계정 상태를 확인하지 못했어요',
    message: '문제가 계속되면 도움을 요청해 주세요.',
    nextAction: 'get-help',
  },
  signInAgain: {
    title: '학습 기록을 합치지 못했어요',
    message: '로그인 확인이 필요해요. SNS 로그인부터 다시 진행해 주세요.',
    nextAction: 'sign-in-again',
  },
  withdrawalPending: {
    title: '가입을 이어가지 못했어요',
    message: '이전 탈퇴 처리가 아직 끝나지 않았어요. 잠시 후 다시 가입해 주세요.',
    nextAction: 'exit',
  },
  unexpected: {
    title: '학습 기록을 합치지 못했어요',
    message: '잠시 후 다시 시도해 주세요.',
    nextAction: 'retry',
  },
  activationFailed: {
    title: '로그인을 마무리하지 못했어요',
    message: '로그인 화면에서 같은 SNS 계정으로 다시 로그인해 주세요.',
    nextAction: 'sign-in-again',
  },
} satisfies Record<string, GuestMergeFailureNotice>;

/** 이번 제출에서 이미 한 번씩 써 버린 자동 복구. 같은 복구를 반복하지 않는 기준이다. */
export type GuestMergeAttempts = { proofRetried: boolean; reconciled: boolean };

/**
 * resubmit: 증명을 다시 강제 갱신해 merge를 다시 보낸다
 * reconcile: 결과를 모르므로 Guest 토큰 prepare로 병합 여부를 판별한다
 * exchange: Guest가 이미 병합·승격됐거나 없다. SNS 계정으로 로그인한다
 */
export type GuestMergeRecoveryDecision =
  | { kind: 'resubmit' }
  | { kind: 'reconcile' }
  | { kind: 'exchange' }
  | { kind: 'target-conflict' }
  | { kind: 'outcome-unknown' }
  | { kind: 'fail'; notice: GuestMergeFailureNotice };

/**
 * 응답을 받지 못했거나 서버가 처리 후 실패했을 수 있는 오류. `GUEST_MERGE_CONFLICT`는 같은 Guest의
 * 요청이 겹쳤다는 뜻이라(타임아웃 뒤 재시도) 앞선 요청이 병합했을 수 있다.
 */
export function isMergeOutcomeUnknown(error: unknown): boolean {
  if (error instanceof TransportConnectionError) return true;
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'GUEST_MERGE_CONFLICT') return true;
  return error.status >= 500 && !DEFINED_SERVER_ERROR_CODES.includes(error.code ?? '');
}

/** 연결·서버 오류는 같은 작업을 다시 시도하고, 나머지는 예상 못 한 실패로 본다. */
function decideRequestFailure(error: unknown): GuestMergeFailureNotice {
  const recovery = classifyAuthRecovery(error);
  if (recovery.action !== 'retry') return GUEST_MERGE_NOTICES.unexpected;
  return {
    title: GUEST_MERGE_NOTICES.unexpected.title,
    message: AUTH_RECOVERY_MESSAGES[recovery.reason],
    nextAction: 'retry',
  };
}

function decideProofFailure(
  proof: Exclude<FirebaseProofResult, { kind: 'proof-ready' }>,
): GuestMergeFailureNotice {
  if (proof.kind === 'failed' && proof.nextAction === 'retry')
    return decideRequestFailure(new TransportConnectionError());
  if (proof.kind === 'failed' && proof.nextAction === 'get-help')
    return GUEST_MERGE_NOTICES.unexpected;
  // 강제 갱신을 못 하면 같은 Firebase 사용자를 더 이상 증명할 수 없다.
  return GUEST_MERGE_NOTICES.signInAgain;
}

/** merge 요청 실패의 다음 행동. 서버 code는 열린 집합이라 알 수 없는 값은 요청 실패로 분류한다. */
export function decideGuestMergeRecovery(
  error: unknown,
  attempts: GuestMergeAttempts,
): GuestMergeRecoveryDecision {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case 'INVALID_FIREBASE_ID_TOKEN':
      return attempts.proofRetried
        ? { kind: 'fail', notice: GUEST_MERGE_NOTICES.signInAgain }
        : { kind: 'resubmit' };
    case 'FIREBASE_RECENT_AUTH_REQUIRED':
      return { kind: 'fail', notice: GUEST_MERGE_NOTICES.signInAgain };
    case 'ACCOUNT_MERGED_TOKEN_REJECTED':
    case 'GUEST_MERGE_NOT_ALLOWED':
    case 'USER_NOT_FOUND':
      return { kind: 'exchange' };
    case 'GUEST_MERGE_TARGET_WITHDRAWN':
      return { kind: 'fail', notice: GUEST_MERGE_NOTICES.targetWithdrawn };
    case 'GUEST_MERGE_TARGET_NOT_ACTIVE':
      return { kind: 'fail', notice: GUEST_MERGE_NOTICES.targetSuspended };
    case 'GUEST_MERGE_TARGET_CONFLICT':
      return { kind: 'target-conflict' };
    case 'WITHDRAWAL_CLEANUP_PENDING':
      return { kind: 'fail', notice: GUEST_MERGE_NOTICES.withdrawalPending };
    default:
      if (isMergeOutcomeUnknown(error)) {
        // 판별은 제출 한 번에 한 번만 자동으로 한다. 그 뒤는 사용자의 수동 재시도다.
        return attempts.reconciled ? { kind: 'outcome-unknown' } : { kind: 'reconcile' };
      }
      return { kind: 'fail', notice: decideRequestFailure(error) };
  }
}

/** 다시 로그인을 한 번 허용한 뒤 도움 요청으로 보낸다. 흐름은 로그인마다 새로 만들어져 기록을 밖에 둔다. */
export interface GuestMergeTargetConflictHistory {
  hasSeen: () => boolean;
  record: () => void;
}

export interface GuestMergeFlowDependencies {
  /** 같은 Firebase 사용자의 ID Token을 강제 갱신한다. */
  refreshProof: (uid: string) => Promise<FirebaseProofResult>;
  /** 현재 Guest Access Token. 만료가 가까우면 세션 컨트롤러가 먼저 재발급한다. */
  prepareRequest: () => Promise<RequestAuthSnapshot>;
  prepare: (
    proof: string,
    guestToken: string,
    signal?: AbortSignal,
  ) => Promise<IdentityGuestPreparationResult>;
  exchange: (proof: string, signal?: AbortSignal) => Promise<IdentityExchangeResult>;
  submitMerge: (
    proof: string,
    guestToken: string,
    signal?: AbortSignal,
  ) => Promise<GuestMergeResult>;
  targetConflicts: GuestMergeTargetConflictHistory;
}

/**
 * MERGE_REQUIRED 뒤 사용자 확인부터 병합 완료까지 한 번의 흐름.
 * 코디네이터는 진입(mergeRequired)과 출구(onComplete, onEnrollmentRequired, onCancel)만 맡는다.
 * 화면이 사라지면 소유자가 dispose해 늦게 도착한 응답을 무시한다.
 */
export function createGuestMergeFlow(options: {
  uid: string;
  dependencies: GuestMergeFlowDependencies;
  onComplete: (result: GuestMergeResult) => Promise<void>;
  /** 병합 대상이 사라져 승격(Guest enrollment) 또는 신규 가입(direct enrollment)으로 이어간다. */
  onEnrollmentRequired: (enrollment: IdentityEnrollment) => void;
}) {
  const { uid, dependencies } = options;
  const store = createStore<{ state: GuestMergeFlowState }>(() => ({
    state: { status: 'confirming' },
  }));
  const abort = new AbortController();
  // 작업을 다시 시작하면 올라간다. 이전 작업의 늦은 결과를 버리는 기준이다.
  let run = 0;
  let disposed = false;
  // 판별까지 실패한 횟수. 두 번째부터 도움 요청을 함께 보인다.
  let outcomeUnknownFailures = 0;
  let lastWork: 'merge' | 'continue-signup' = 'merge';

  const isCurrent = (value: number) => !disposed && value === run;
  const setState = (state: GuestMergeFlowState) => store.setState({ state });

  function fail(notice: GuestMergeFailureNotice): void {
    setState({ status: 'failed', ...notice });
  }

  function failOutcomeUnknown(): void {
    outcomeUnknownFailures += 1;
    fail(
      outcomeUnknownFailures > 1
        ? GUEST_MERGE_NOTICES.outcomeUnknownRepeated
        : GUEST_MERGE_NOTICES.outcomeUnknown,
    );
  }

  function failTargetConflict(): void {
    if (dependencies.targetConflicts.hasSeen()) {
      fail(GUEST_MERGE_NOTICES.targetConflictRepeated);
      return;
    }
    dependencies.targetConflicts.record();
    fail(GUEST_MERGE_NOTICES.targetConflict);
  }

  /** 서버가 발급한 MEMBER 세션을 코디네이터에 넘긴다. 병합 요청과 다른 try로 감싸 분류를 섞지 않는다. */
  async function complete(result: GuestMergeResult): Promise<void> {
    try {
      await options.onComplete(result);
    } catch {
      if (!disposed) fail(GUEST_MERGE_NOTICES.activationFailed);
    }
  }

  async function freshProof(
    current: number,
  ): Promise<Extract<FirebaseProofResult, { kind: 'proof-ready' }> | null> {
    const proof = await dependencies.refreshProof(uid);
    if (!isCurrent(current)) return null;
    if (proof.kind !== 'proof-ready') {
      fail(decideProofFailure(proof));
      return null;
    }
    return proof;
  }

  /**
   * Guest가 이미 병합·승격됐거나 서버에 없다. SNS 계정 기준으로 로그인한다.
   * 이 경로에서는 mergeId를 알 수 없어 학습 기록 이전을 조회하지 않는다.
   */
  async function exchangeAndFinish(current: number, proofToken: string): Promise<void> {
    let exchanged: IdentityExchangeResult;
    try {
      exchanged = await dependencies.exchange(proofToken, abort.signal);
    } catch (error) {
      if (isCurrent(current)) fail(decideRequestFailure(error));
      return;
    }
    if (!isCurrent(current)) return;
    if (exchanged.kind === 'enrollment-required') {
      options.onEnrollmentRequired(exchanged.enrollment);
      return;
    }
    await complete({ session: exchanged.session, mergeId: null });
  }

  /**
   * 병합 결과를 모를 때 판별한다. 병합은 성공·실패와 무관하게 exchange가 대상 MEMBER를 주므로
   * exchange만으로 판별하지 않는다. 병합에 쓴 Guest 토큰으로 prepare를 불러 Guest가 살아 있는지 본다.
   *   403 GUEST_UPGRADE_NOT_ALLOWED / 401 ACCOUNT_MERGED_TOKEN_REJECTED → 병합됨 → exchange
   *   MERGE_REQUIRED → 병합되지 않음 → 확인 없이 merge를 다시 보낸다
   *   ENROLLMENT_REQUIRED → 대상 MEMBER가 사라졌다 → 승격으로 이어간다
   */
  async function reconcile(current: number, guestToken: string): Promise<'resend' | 'stop'> {
    const proof = await freshProof(current);
    if (!proof) return 'stop';
    let result: IdentityGuestPreparationResult;
    try {
      result = await dependencies.prepare(proof.firebaseIdToken, guestToken, abort.signal);
    } catch (error) {
      if (!isCurrent(current)) return 'stop';
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === 'GUEST_UPGRADE_NOT_ALLOWED' || code === 'ACCOUNT_MERGED_TOKEN_REJECTED') {
        await exchangeAndFinish(current, proof.firebaseIdToken);
        return 'stop';
      }
      if (code === 'MERGE_REQUIRED') return 'resend';
      failOutcomeUnknown();
      return 'stop';
    }
    if (!isCurrent(current)) return 'stop';
    if (result.kind === 'merge-required') return 'resend';
    options.onEnrollmentRequired(result.enrollment);
    return 'stop';
  }

  async function submit(): Promise<void> {
    if (store.getState().state.status === 'submitting') return;
    run += 1;
    const current = run;
    lastWork = 'merge';
    setState({ status: 'submitting' });
    const attempts: GuestMergeAttempts = { proofRetried: false, reconciled: false };

    for (;;) {
      const proof = await freshProof(current);
      if (!proof) return;

      let guest: RequestAuthSnapshot;
      try {
        guest = await dependencies.prepareRequest();
      } catch (error) {
        // Guest 세션이 무효면 세션 컨트롤러 알림으로 코디네이터가 흐름을 끝낸다.
        if (isCurrent(current)) fail(decideRequestFailure(error));
        return;
      }
      if (!isCurrent(current)) return;

      let result: GuestMergeResult;
      try {
        result = await dependencies.submitMerge(
          proof.firebaseIdToken,
          guest.accessToken,
          abort.signal,
        );
      } catch (error) {
        if (!isCurrent(current)) return;
        const decision = decideGuestMergeRecovery(error, attempts);
        switch (decision.kind) {
          case 'resubmit':
            attempts.proofRetried = true;
            continue;
          case 'reconcile':
            attempts.reconciled = true;
            if ((await reconcile(current, guest.accessToken)) === 'resend') continue;
            return;
          case 'exchange':
            await exchangeAndFinish(current, proof.firebaseIdToken);
            return;
          case 'target-conflict':
            failTargetConflict();
            return;
          case 'outcome-unknown':
            failOutcomeUnknown();
            return;
          case 'fail':
            fail(decision.notice);
            return;
        }
      }
      if (!isCurrent(current)) return;
      await complete(result);
      return;
    }
  }

  /** 대상 계정이 탈퇴했다. prepare로 새 enrollment를 받아 승격 흐름으로 넘긴다. */
  async function continueSignup(): Promise<void> {
    if (store.getState().state.status === 'submitting') return;
    run += 1;
    const current = run;
    lastWork = 'continue-signup';
    setState({ status: 'submitting' });
    const proof = await freshProof(current);
    if (!proof) return;
    let result: IdentityGuestPreparationResult;
    try {
      const guest = await dependencies.prepareRequest();
      if (!isCurrent(current)) return;
      result = await dependencies.prepare(proof.firebaseIdToken, guest.accessToken, abort.signal);
    } catch (error) {
      if (!isCurrent(current)) return;
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === 'MERGE_REQUIRED') setState({ status: 'confirming' });
      else if (code === 'WITHDRAWAL_CLEANUP_PENDING') fail(GUEST_MERGE_NOTICES.withdrawalPending);
      else fail(decideRequestFailure(error));
      return;
    }
    if (!isCurrent(current)) return;
    // 그사이 같은 SNS 계정으로 다시 가입된 MEMBER가 있으면 병합 확인으로 돌아간다.
    if (result.kind === 'merge-required') setState({ status: 'confirming' });
    else options.onEnrollmentRequired(result.enrollment);
  }

  function confirm(): void {
    if (store.getState().state.status !== 'confirming') return;
    void submit();
  }

  /** 실패 화면의 "다시 시도". 마지막으로 하던 작업을 다시 한다. */
  function retry(): void {
    const { state } = store.getState();
    if (state.status !== 'failed') return;
    switch (state.nextAction) {
      case 'retry':
      case 'retry-or-help':
        void (lastWork === 'merge' ? submit() : continueSignup());
        return;
      case 'continue-signup':
        void continueSignup();
        return;
      case 'get-help':
      case 'sign-in-again':
      case 'exit':
        // 도움 요청·로그인 화면 복귀는 화면이 처리한다.
        return;
    }
    const unhandled: never = state.nextAction;
    throw new Error(`처리하지 않은 병합 실패 행동: ${unhandled}`);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    abort.abort();
  }

  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    confirm,
    retry,
    dispose,
  };
}
