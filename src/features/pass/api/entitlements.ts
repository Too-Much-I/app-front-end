import { entitlementsSchema, mapExamAdmission } from '@/features/pass/map-exam-admission';
import { billingFetchWithAuthRetry } from '@/lib/api/client';
import { parseApiResult } from '@/lib/api/parse-api-result';
import type { ApiEnvelope } from '@/types/api';
import type { ExamAdmission } from '@/types/pass';

/** 무료·유료 이용권 통합 조회(`GET /api/v1/entitlements`). 실패는 던진다 — 0개·사용 완료로 바꾸지 않는다. */
export async function getExamAdmission(signal?: AbortSignal): Promise<ExamAdmission> {
  const { result } = await billingFetchWithAuthRetry<ApiEnvelope<unknown>>('/api/v1/entitlements', {
    signal,
  });
  return mapExamAdmission(parseApiResult(entitlementsSchema, result, 'ENTITLEMENTS'));
}
