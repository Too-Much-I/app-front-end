import type { ExamHistoryTone } from "@/features/exam/map-exam-history";
import { colors } from "@/theme";

/**
 * 이력 도메인 값을 표시값으로 바꾸는 규칙.
 *
 * 등급 배지·추이 그래프의 점·카드의 날짜가 같은 데이터를 같은 규칙으로 보여야 하므로
 * 변환을 한 곳에 둔다.
 */

/** 등급 배지와 추이 그래프의 점이 같은 등급에 같은 색을 써야 둘이 한 데이터로 읽힌다. */
export const historyToneColors: Record<
  ExamHistoryTone,
  { backgroundColor: string; color: string }
> = {
  green: {
    backgroundColor: colors.feedback.history.greenSoft,
    color: colors.feedback.history.green,
  },
  blue: {
    backgroundColor: colors.feedback.history.blueSoft,
    color: colors.feedback.history.blue,
  },
  purple: {
    backgroundColor: colors.feedback.history.purpleSoft,
    color: colors.feedback.history.purple,
  },
  orange: {
    backgroundColor: colors.feedback.history.orangeSoft,
    color: colors.feedback.history.orange,
  },
};

export function formatCompletedDate(completedAt: string): string {
  const date = new Date(completedAt);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
