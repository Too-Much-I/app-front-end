import { z } from 'zod';

import type { ExamAdmission, ExamAdmissionSource } from '@/types/pass';

/**
 * `GET /api/v1/entitlements`에서 모의고사 진입에 읽는 값(Billing 명세 2026-10-14).
 *
 * 진입 여부는 `examAvailability.canTakeExam` 하나로 정한다 — `paid.active`나 무료 수량으로 대신 판단하지
 * 않는다(명세). 나머지는 화면 안내용이다. 서버 확장이 꺼지면 `paid`·`examAvailability`가 통째로 없고, 모르는
 * 값은 null로 온다. 모르는 enum 값이 와도 응답 전체를 버리지 않게 문자열로 받는다.
 */
export const entitlementsSchema = z.object({
  paid: z
    .object({
      continuousAccessEndsAt: z.string().nullish(),
      hasPendingSync: z.boolean().nullish(),
    })
    .nullish(),
  examAvailability: z
    .object({
      canTakeExam: z.boolean().nullish(),
      preferredSource: z.string().nullish(),
    })
    .nullish(),
});

function toSource(preferredSource: string | null | undefined): ExamAdmissionSource | null {
  switch (preferredSource) {
    case 'PAID':
      return 'paid';
    case 'FREE_NEW':
    case 'FREE_RETAKE':
      return 'free';
    default:
      return null;
  }
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapExamAdmission(raw: z.infer<typeof entitlementsSchema>): ExamAdmission {
  const canTakeExam = raw.examAvailability?.canTakeExam;
  const hasPendingPayment = raw.paid?.hasPendingSync === true;
  if (canTakeExam === true) {
    return {
      kind: 'allowed',
      source: toSource(raw.examAvailability?.preferredSource),
      paidEndsAt: toDate(raw.paid?.continuousAccessEndsAt),
      hasPendingPayment,
    };
  }
  if (canTakeExam === false)
    return hasPendingPayment ? { kind: 'payment-pending' } : { kind: 'pass-required' };
  return { kind: 'unknown' };
}
