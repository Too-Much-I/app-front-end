/** 모의고사 진입 확인 결과. `GET /api/v1/entitlements`를 `map-exam-admission.ts`가 옮긴다. */

/** 이번 시험에 쓰일 출처. 서버가 권하는 값이고 앱이 고르는 것은 아니다. */
export type ExamAdmissionSource = 'free' | 'paid';

export type ExamAdmission =
  | {
      kind: 'allowed';
      source: ExamAdmissionSource | null;
      /** 이어 붙은 이용권까지 포함한 최종 종료 시각. */
      paidEndsAt: Date | null;
      /** 반영을 기다리는 결제가 있다. 기존 이용권은 그대로다. */
      hasPendingPayment: boolean;
    }
  /** 막혔지만 반영을 기다리는 결제가 있다. 결제 화면으로 보내면 두 번 결제할 수 있다. */
  | { kind: 'payment-pending' }
  | { kind: 'pass-required' }
  /** 서버도 판정하지 못했다. 막고 다시 시도하게 한다(2026-10-14 결정). */
  | { kind: 'unknown' };
