import type { ZodType } from "zod";

import { ApiError } from "@/lib/api/transport";
import {
  reportOperationalError,
  type ApiResponseResource,
} from "@/lib/operational-error-reporting";

/**
 * 스키마 불일치는 전송 실패가 아니라 200 응답의 내용 문제다.
 *
 * `ApiError`는 status를 요구하는데 이 실패에는 대응하는 HTTP status가 없다. 서버가
 * 성공이라고 답한 뒤 모양이 어긋난 것이므로 성공 status를 그대로 둔다 — 진단에서
 * "서버는 OK라고 했는데 우리가 읽지 못했다"로 읽히는 편이 정확하다.
 */
const SCHEMA_MISMATCH_STATUS = 200;

/** 사용자에게는 원인을 설명하지 않는다. 고칠 수 있는 종류의 실패가 아니다. */
const SCHEMA_MISMATCH_MESSAGE = "응답을 처리하지 못했습니다.";

/**
 * 서버 응답을 스키마로 확인한 뒤 넘긴다.
 *
 * `apiFetch`의 제네릭은 주장일 뿐 아무것도 검증하지 않으므로(`return envelope as T`),
 * 근거 없는 주장이 근거 있는 것으로 바뀌는 자리가 여기다.
 *
 * 어긋난 응답을 화면까지 조용히 내려보내지 않는 것이 목적이다. 매퍼가 방어적이라
 * 필드가 사라져도 크래시 없이 빈 화면이 되는데, 그 침묵이 가장 비싼 실패였다.
 */
export function parseApiResult<T>(
  schema: ZodType<T>,
  value: unknown,
  resource: ApiResponseResource,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const [issue] = parsed.error.issues;
  reportOperationalError({
    code: "API_RESPONSE_VALIDATION_FAILED",
    resource,
    // 서버가 보낸 값이 아니라 우리 스키마 기준의 경로와 사유만 보낸다.
    // 응답 본문은 기존 보고 정책대로 전송하지 않는다.
    issuePath: issue.path.map(String).join(".") || "(root)",
    issueCode: issue.code,
  });

  throw new ApiError(
    SCHEMA_MISMATCH_STATUS,
    SCHEMA_MISMATCH_MESSAGE,
    "API_RESPONSE_VALIDATION_FAILED",
  );
}
