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

function reportMismatch(
  error: { issues: readonly { path: readonly PropertyKey[]; code: string }[] },
  resource: ApiResponseResource,
  mode: "enforced" | "observed",
): void {
  const [issue] = error.issues;
  reportOperationalError({
    code: "API_RESPONSE_VALIDATION_FAILED",
    resource,
    mode,
    // 서버가 보낸 값이 아니라 우리 스키마 기준의 경로와 사유만 보낸다.
    // 응답 본문은 기존 보고 정책대로 전송하지 않는다.
    issuePath: issue.path.map(String).join(".") || "(root)",
    issueCode: issue.code,
  });
}

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

  reportMismatch(parsed.error, resource, "enforced");
  throw new ApiError(
    SCHEMA_MISMATCH_STATUS,
    SCHEMA_MISMATCH_MESSAGE,
    "API_RESPONSE_VALIDATION_FAILED",
  );
}

/**
 * 스키마를 켜지 않고 어긋남만 기록한다 — 이미 운영 중인 엔드포인트의 1단계.
 *
 * 새로 쓴 스키마가 실제 트래픽과 맞는지는 코드를 읽어서 알 수 없다. 기존 매퍼의 방어
 * 코드는 "서버가 이럴 때가 있었다"는 기록일 수도, 그냥 조심스러웠던 것일 수도 있는데
 * 둘을 구분할 방법이 없기 때문이다. 픽스처로도 못 메운다 — 픽스처에는 우리가 아는
 * 경우만 들어간다.
 *
 * 그래서 계약대로 엄격하게 쓴 스키마를 먼저 관찰 전용으로 걸어 두고, 실제 응답이
 * 무엇을 위반하는지 며칠 모은다. 이 함수는 값을 바꾸지도 던지지도 않으므로 화면 동작은
 * 그대로다. Sentry가 조용해지면 그때 `parseApiResult`로 바꾼다.
 */
export function reportApiResultMismatch(
  schema: ZodType<unknown>,
  value: unknown,
  resource: ApiResponseResource,
): void {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    reportMismatch(parsed.error, resource, "observed");
  }
}
