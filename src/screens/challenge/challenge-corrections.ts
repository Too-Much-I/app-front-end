import { colors } from "@/theme";
import type { ChallengeCorrectionItem } from "@/types/challenge";

/**
 * 첨삭 표시 규칙 — 심각도·종류 정규화와 밑줄 구간 계산.
 *
 * 서버가 심각도 어휘도 문자 위치도 고정해 주지 않아, 화면에 그리기 직전에 앱이 좁힌다.
 * 결과 화면과 첨삭 시트가 같은 색·같은 라벨을 쓰도록 그 규칙을 한 곳에 둔다.
 */

/**
 * 첨삭 심각도 3단계.
 *
 * 서버 값을 이 셋으로 좁히는 일은 타입이 아니라 화면 직전에 한다. AI가 문제마다 다른
 * 어휘를 쓰기 때문에(`major`/`minor` 등 시험 도메인에서 실측) union으로 받으면
 * 모르는 값 하나에 스타일이 통째로 비어버린다.
 */
export type ChallengeCorrectionSeverity = "high" | "medium" | "low";

/** 알려진 동의어. 웹 상세 피드백이 쓰던 표를 그대로 가져왔다. */
const SEVERITY_ALIASES: Record<string, ChallengeCorrectionSeverity> = {
  high: "high",
  major: "high",
  critical: "high",
  medium: "medium",
  moderate: "medium",
  low: "low",
  minor: "low",
};

/** 모르는 값은 `medium`으로 떨어뜨린다 — 색이 undefined가 되는 쪽이 더 나쁘다. */
export function normalizeCorrectionSeverity(severity: string): ChallengeCorrectionSeverity {
  return SEVERITY_ALIASES[severity.toLowerCase()] ?? "medium";
}

export const CORRECTION_SEVERITY_LABEL: Record<ChallengeCorrectionSeverity, string> = {
  high: "심각",
  medium: "보통",
  low: "경미",
};

/** 밑줄과 배지가 같은 색을 쓰도록 판정을 한 곳에 둔다. */
export function getCorrectionSeverityColor(severity: string): string {
  return colors.challenge.correction[normalizeCorrectionSeverity(severity)];
}

/**
 * 첨삭 종류 라벨.
 *
 * 서버는 `GRAMMAR`처럼 대문자로 주고 웹 표는 소문자 키라, 소문자로 맞춘 뒤 찾는다.
 * 모르는 종류는 항목을 숨기지 않고 "기타"로 보여준다 — 설명 자체는 여전히 쓸모 있다.
 */
const CORRECTION_TYPE_LABEL: Record<string, string> = {
  grammar: "문법",
  expression: "표현",
  vocabulary: "어휘",
  content: "내용",
};

export function getCorrectionTypeLabel(type: string): string {
  return CORRECTION_TYPE_LABEL[type.toLowerCase()] ?? "기타";
}

/** 밑줄 한 구간. `index`는 `corrections` 배열의 위치이자 시트를 여는 값이다. */
export interface ChallengeCorrectionSpan {
  index: number;
  start: number;
  end: number;
}

/**
 * 첨삭 항목의 `original`을 내 문장에서 찾아 밑줄 구간으로 바꾼다.
 *
 * 서버가 문자 위치를 주지 않아 앱이 문자열로 찾는다. 웹 상세 피드백과 같은 규칙이다 —
 * `indexOf`로 첫 등장만 쓰고, 못 찾으면 그 항목은 밑줄 없이 넘어간다. 못 찾는 경우는
 * 실제로 생긴다: `original`이 문장 전체이거나 STT 표기와 미세하게 어긋날 때다. 그 항목은
 * 사라지지 않고 화면의 "그 외 지적" 줄로 모인다.
 *
 * 겹치는 구간은 앞선 것만 남긴다. 웹은 포함 관계를 중첩 마킹으로 그렸지만 여기서는
 * 밑줄이 한 종류뿐이라 겹쳐 그어도 어느 지적인지 구분되지 않는다.
 */
export function findCorrectionSpans(
  transcript: string,
  corrections: ChallengeCorrectionItem[],
): ChallengeCorrectionSpan[] {
  const found: ChallengeCorrectionSpan[] = [];

  corrections.forEach((correction, index) => {
    if (correction.original.length === 0) return;
    const start = transcript.indexOf(correction.original);
    if (start === -1) return;
    found.push({ index, start, end: start + correction.original.length });
  });

  found.sort((a, b) => a.start - b.start);

  const spans: ChallengeCorrectionSpan[] = [];
  let cursor = 0;
  for (const span of found) {
    if (span.start < cursor) continue;
    spans.push(span);
    cursor = span.end;
  }
  return spans;
}
