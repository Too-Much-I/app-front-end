import type { AudioSource } from "expo-audio";

import {
  areExamTableContextsEqual,
  mapExamTableContext,
  reportExamTableContractIssues,
} from "@/features/exam/map-exam-table-context";
import type {
  ExamPartPrelude,
  ExamPartPreludeInvalidReason,
  ExamTableContext,
  RawExamQuestion,
} from "@/types/exam";

/** 번들 음원을 찾기 위한 synthetic lookup key이며 원격 요청에 사용하는 URL이 아니다. */
export const PART3_GUIDE_AUDIO_LOGICAL_URL = "/assets/audio/part3_intro.wav";
export const PART4_READING_DURATION_SEC = 45 as const;
const PART4_FIRST_QUESTION_NUMBER = 8;

const PART3_GUIDE_AUDIO_SOURCES: Record<string, AudioSource> = {
  [PART3_GUIDE_AUDIO_LOGICAL_URL]: require("../../../public/assets/audio/part3_intro.wav"),
};

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isSupportedExamPartIntroAudioUrl(audioUrl: string): boolean {
  return audioUrl in PART3_GUIDE_AUDIO_SOURCES || /^https?:\/\//i.test(audioUrl);
}

export function getExamPartIntroAudioSource(audioUrl: string): AudioSource | undefined {
  const bundledSource = PART3_GUIDE_AUDIO_SOURCES[audioUrl];
  if (bundledSource !== undefined) return bundledSource;
  return /^https?:\/\//i.test(audioUrl) ? { uri: audioUrl } : undefined;
}

interface ExamPartPreludeNormalization {
  partPreludes: ExamPartPrelude[];
  canonicalPart4TableContext?: ExamTableContext;
}

function invalidPrelude(
  partNumber: 3 | 4,
  reason: ExamPartPreludeInvalidReason,
): ExamPartPrelude {
  return { kind: "invalid", partNumber, reason };
}

function normalizePart3Prelude(questions: RawExamQuestion[]): ExamPartPrelude {
  const firstQuestion = questions[0];
  const text = trimNonEmpty(firstQuestion?.partIntroText);
  const guideAudioUrl = trimNonEmpty(firstQuestion?.guideAudioUrl);
  const hasLaterContent = questions.slice(1).some(
    (question) =>
      trimNonEmpty(question.partIntroText) !== undefined ||
      trimNonEmpty(question.guideAudioUrl) !== undefined,
  );

  if ((!text || !guideAudioUrl) && hasLaterContent) {
    return invalidPrelude(3, "misplaced-part3-content");
  }
  if (!text) return invalidPrelude(3, "missing-part3-intro");
  if (!guideAudioUrl) return invalidPrelude(3, "missing-part3-guide-audio");
  if (!isSupportedExamPartIntroAudioUrl(guideAudioUrl)) {
    return invalidPrelude(3, "unsupported-part3-guide-audio");
  }

  return { kind: "part3-intro", partNumber: 3, text, guideAudioUrl };
}

function normalizePart4Prelude(
  questions: RawExamQuestion[],
): { prelude: ExamPartPrelude; canonicalTableContext?: ExamTableContext } {
  const firstQuestion = questions.find(
    (question) => question.questionNumber === PART4_FIRST_QUESTION_NUMBER,
  );
  const laterQuestions = questions.filter(
    (question) => question.questionNumber !== PART4_FIRST_QUESTION_NUMBER,
  );

  if (firstQuestion?.tableContext === undefined) {
    const hasLaterTable = laterQuestions.some(
      (question) => question.tableContext !== undefined,
    );
    return {
      prelude: invalidPrelude(
        4,
        hasLaterTable ? "misplaced-part4-table" : "missing-part4-table",
      ),
    };
  }

  const firstMapping = mapExamTableContext(firstQuestion.tableContext);
  reportExamTableContractIssues(
    `question ${firstQuestion.questionNumber}`,
    firstMapping.issues,
  );
  if (!firstMapping.ok) {
    return { prelude: invalidPrelude(4, "invalid-part4-table") };
  }
  const canonicalTableContext = firstMapping.value;

  for (const question of laterQuestions) {
    if (question.tableContext === undefined) continue;
    const repeatedMapping = mapExamTableContext(question.tableContext);
    reportExamTableContractIssues(
      `question ${question.questionNumber}`,
      repeatedMapping.issues,
    );
    if (!repeatedMapping.ok) {
      return { prelude: invalidPrelude(4, "invalid-part4-table") };
    }
    if (!areExamTableContextsEqual(repeatedMapping.value, canonicalTableContext)) {
      return { prelude: invalidPrelude(4, "conflicting-part4-table") };
    }
  }

  return {
    prelude: {
      kind: "part4-reading",
      partNumber: 4,
      tableContext: canonicalTableContext,
      durationSec: PART4_READING_DURATION_SEC,
    },
    canonicalTableContext,
  };
}

/**
 * 파트 안내를 마친 뒤 무엇을 해야 하는지에 대한 판정 결과.
 *
 * `failed`는 서두가 아예 없는 경우와 정규화 단계에서 invalid로 판정된 경우를
 * 함께 담는다. 둘 다 화면 대응(`part-prelude-error`)과 리포트 코드가 같고
 * `reason`만 다르기 때문이다.
 */
export type PartPreludeDecision =
  | { kind: "none" }
  | { kind: "part3-intro" }
  | { kind: "part4-reading"; durationMs: number }
  | {
      kind: "failed";
      partNumber: 3 | 4;
      reason: ExamPartPreludeInvalidReason | "missing-prelude";
    };

/**
 * 파트 번호와 해당 파트의 서두로 다음 동작을 정한다.
 *
 * 부수효과 없이 값만 돌려주므로 호출부는 판정과 전이를 따로 읽을 수 있다.
 * Part 1·2는 서두가 없는 것이 정상이라 `none`이지만, Part 3·4에서 서두가
 * 비어 있으면 문항 데이터가 깨진 것이므로 `failed`로 구분한다.
 */
export function decidePartPrelude(
  partNumber: number,
  partPrelude: ExamPartPrelude | undefined,
): PartPreludeDecision {
  if (partPrelude === undefined) {
    if (partNumber === 3 || partNumber === 4) {
      return { kind: "failed", partNumber, reason: "missing-prelude" };
    }
    return { kind: "none" };
  }

  switch (partPrelude.kind) {
    case "invalid":
      return {
        kind: "failed",
        partNumber: partPrelude.partNumber,
        reason: partPrelude.reason,
      };
    case "part3-intro":
      return { kind: "part3-intro" };
    case "part4-reading":
      return { kind: "part4-reading", durationMs: partPrelude.durationSec * 1_000 };
  }
}

export function normalizeExamPartPreludes(
  rawQuestions: RawExamQuestion[],
): ExamPartPreludeNormalization {
  const partPreludes: ExamPartPrelude[] = [];
  const part3Questions = rawQuestions.filter((question) => question.part === 3);
  if (part3Questions.length > 0) {
    partPreludes.push(normalizePart3Prelude(part3Questions));
  }

  const part4Questions = rawQuestions.filter((question) => question.part === 4);
  if (part4Questions.length === 0) return { partPreludes };

  const part4Normalization = normalizePart4Prelude(part4Questions);
  partPreludes.push(part4Normalization.prelude);
  return {
    partPreludes,
    ...(part4Normalization.canonicalTableContext
      ? { canonicalPart4TableContext: part4Normalization.canonicalTableContext }
      : {}),
  };
}
