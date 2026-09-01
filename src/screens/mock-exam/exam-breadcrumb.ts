import { emitBreadcrumb, type OperationalContextValue } from "@/lib/sentry";

/**
 * 지점은 갈라지되(phase는 store, lifecycle은 화면) 스키마는 하나로 유지해 Sentry
 * 타임라인에서 시간순으로 같이 읽히게 한다.
 */
export type ExamBreadcrumbCategory = "exam.phase" | "exam.lifecycle";

export function emitExamBreadcrumb(
  category: ExamBreadcrumbCategory,
  data: Record<string, OperationalContextValue>,
  level?: "info" | "warning",
): void {
  emitBreadcrumb(category, data, level);
}
