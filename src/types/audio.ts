/**
 * 재생 실패를 어디서 감지했는가. 문구와 무관하게 정확한 값이라 판단의 1차 기준이다.
 *
 * - `start-call`: 재생을 시작하는 호출(`setAudioModeAsync`·`seekTo`·`play`)이 던졌다.
 *   오디오 세션을 잡지 못한 쪽에 가깝다.
 * - `player-status`: 플레이어가 `status.error`를 올렸다. 음원을 열지 못한 쪽에 가깝다.
 *
 * 둘은 원인 계열이 다르므로 같은 `playback`으로 뭉뚱그리면 조사할 방향이 사라진다.
 */
export type AudioPlaybackFailureOrigin = "start-call" | "player-status";

/**
 * 재생 실패 사유를 접어 둔 닫힌 집합.
 *
 * 플랫폼이 주는 서술은 자유 텍스트이고 URL이 섞일 수 있어 원문을 그대로 내보내지
 * 않는다. `classifyAudioPlaybackError`가 이 값으로만 접어서 넘긴다.
 *
 * `unknown`은 실패가 아니라 정상적인 기본값이다 — 플랫폼 문구는 OS 판올림마다
 * 바뀌므로 분류표는 최선의 근사이지 계약이 아니다.
 */
export type AudioPlaybackErrorKind =
  | "offline"
  | "timed-out"
  | "unreachable"
  | "forbidden"
  | "not-found"
  | "server-error"
  | "unsupported-format"
  | "session"
  | "unknown";
