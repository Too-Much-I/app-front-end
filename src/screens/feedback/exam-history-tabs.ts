/**
 * 시험 이력 화면의 탭 정의.
 *
 * 탭 목록·순서·전환 시간을 한 곳에 둔다. 인디케이터를 그리는 `HistoryTabs`와 패널을
 * 밀어 넣는 `ExamHistoryTabView`가 같은 순서와 같은 길이로 움직여야 한 동작으로 읽힌다.
 */

export type HistoryTab = "reanswers" | "exams";

/** 탭 순서가 곧 슬라이드 방향의 기준이다. */
export const HISTORY_TABS: readonly { key: HistoryTab; label: string }[] = [
  { key: "reanswers", label: "다시 답변한 문제" },
  { key: "exams", label: "모의고사 기록" },
];

export function tabIndexOf(tab: HistoryTab): number {
  return HISTORY_TABS.findIndex((item) => item.key === tab);
}

export const TAB_TRANSITION_DURATION_MS = 220;
