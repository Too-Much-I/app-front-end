import type { AudioPlaybackErrorKind } from "@/types/audio";

/**
 * 분류표. 위에서부터 처음 걸리는 항목이 답이다.
 *
 * 숫자 상태 코드는 `code`/`status` 같은 말머리가 앞에 있을 때만 읽는다. 문구 어딘가의
 * 세 자리 숫자를 상태 코드로 오인하면 조사를 엉뚱한 곳으로 보내기 때문이다. 대신
 * 플랫폼이 쓰는 NSError 코드(`error -1009` 등)는 형태가 고유해 그대로 받는다.
 */
const ERROR_KIND_PATTERNS: readonly (readonly [RegExp, AudioPlaybackErrorKind])[] = [
  [/not connected to the internet|network (?:is )?offline|\berror -1009\b/i, "offline"],
  [/timed out|\berror -1001\b/i, "timed-out"],
  [
    /cannot find host|cannot connect to host|could not be found|\berror -100[34]\b/i,
    "unreachable",
  ],
  [/(?:code|status)\D{0,3}\b40[13]\b|forbidden|unauthorized|access denied/i, "forbidden"],
  // `not found`는 자유 문구로 두지 않는다. "codec not found"처럼 다른 계열의 실패에도
  // 흔히 섞이는데, 이 표는 순서대로 먼저 걸리는 항목이 답이라 뒤의 더 정확한 분류를
  // 가로챈다. 다른 항목의 문구들과 달리 이 말은 그 자체로 변별력이 없다.
  [/(?:code|status)\D{0,3}\b404\b/i, "not-found"],
  [
    /(?:code|status)\D{0,3}\b5\d{2}\b|internal server error|not correctly configured/i,
    "server-error",
  ],
  [
    /unsupported|cannot (?:open|decode)|unrecognized format|codec|\berror -1182\d\b/i,
    "unsupported-format",
  ],
  // `AVAudioSession`처럼 붙여 쓰는 표기가 실제로 더 흔하다.
  [/audio\s?session|interrupt/i, "session"],
];

function toErrorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return "";
}

/**
 * 재생 실패 서술을 `AudioPlaybackErrorKind`로 접는다.
 *
 * `AudioStatus.error`(`string | null`)와 catch로 잡은 값을 함께 받는다. 원문은 어디에도
 * 싣지 않고 분류한 값만 내보낸다 — `operational-error-reporting.ts`가 `ApiError`를
 * status와 code로만 접어 보내는 것과 같은 규칙이다.
 *
 * 외부 입력을 다루므로 총함수가 아니라 `unknown` fallback을 둔 부분 판정이다.
 */
export function classifyAudioPlaybackError(value: unknown): AudioPlaybackErrorKind {
  const message = toErrorMessage(value);
  if (message.length === 0) return "unknown";

  for (const [pattern, kind] of ERROR_KIND_PATTERNS) {
    if (pattern.test(message)) return kind;
  }

  return "unknown";
}
