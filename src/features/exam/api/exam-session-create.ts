import { mapExamSession } from '@/features/exam/map-exam-session';
import { apiFetch } from '@/lib/api/client';
import type { ApiEnvelope } from '@/types/api';
import type { ExamSession, RawExamSession } from '@/types/exam';

/**
 * 새 모의고사 세션을 생성하고 문제 목록을 받아온다.
 *
 * v2는 Idempotency-Key를 받는 경로다. 키를 보내지 않는 이전 버전 앱은 v1을 계속 쓴다(서버 2026-10-17).
 * 같은 `idempotencyKey`로 다시 보내면 서버는 아까 만든 세션을 돌려준다. 키를 언제 바꿀지는
 * `exam-creation-key.ts`가 정한다.
 */
export async function createExamSession(
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ExamSession> {
  const { result } = await apiFetch<ApiEnvelope<RawExamSession>>('/api/v2/exams', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    signal,
  });
  return mapExamSession(result);
}
