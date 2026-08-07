import { getExamPartTimingByQuestionNumber } from "@/features/exam/part-meta";
import {
  ExamTableContextError,
  mapExamTableContext,
  reportExamTableContractIssues,
} from "@/features/exam/map-exam-table-context";
import type { ExamQuestionInfo, RawExamQuestionInfo } from "@/types/exam";

/**
 * 서버 문제 원문을 앱 도메인 타입으로 옮긴다.
 *
 * 준비·답변 제한 시간은 TOEIC Speaking 파트 구성에 따라 정해지는 값이므로 서버 응답에
 * 의존하지 않는다. 응시 화면과 같은 로컬 규칙을 사용해야 어느 진입 경로에서도 시간이 같다.
 */
export function mapExamQuestionInfo(raw: RawExamQuestionInfo): ExamQuestionInfo {
  const timing = getExamPartTimingByQuestionNumber(raw.part, raw.questionNumber);
  const tableMapping =
    raw.tableContext === undefined ? undefined : mapExamTableContext(raw.tableContext);

  if (tableMapping) {
    reportExamTableContractIssues(
      `question detail ${raw.questionNumber}`,
      tableMapping.issues,
    );
  }
  if (raw.part === 4 && (!tableMapping || !tableMapping.ok)) {
    throw new ExamTableContextError(
      `Part 4 question ${raw.questionNumber} is missing a displayable table context`,
      tableMapping?.issues ?? [],
    );
  }

  return {
    partNumber: raw.part,
    questionNumber: raw.questionNumber,
    text: raw.text,
    referenceText: raw.referenceText,
    partIntroText: raw.partIntroText,
    audioUrl: raw.audioUrl,
    guideAudioUrl: raw.guideAudioUrl,
    imageUrl: raw.imageUrl,
    tableContext: tableMapping?.ok ? tableMapping.value : undefined,
    ...timing,
  };
}
