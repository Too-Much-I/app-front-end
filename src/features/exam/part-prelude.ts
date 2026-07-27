import type { AudioSource } from "expo-audio";

import type {
  ExamPartPrelude,
  ExamPartPreludeInvalidReason,
  ExamTableContext,
  ExamTableItem,
  RawExamQuestion,
} from "@/types/exam";

export const PART3_GUIDE_AUDIO_LOGICAL_URL = "/assets/audio/part3_intro.wav";
export const PART4_READING_DURATION_SEC = 45 as const;

const PART3_GUIDE_AUDIO_SOURCES: Record<string, AudioSource> = {
  [PART3_GUIDE_AUDIO_LOGICAL_URL]: require("../../../public/assets/audio/part3_intro.wav"),
};

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTableItem(item: ExamTableItem): ExamTableItem | undefined {
  const time = trimNonEmpty(item.time);
  const sessionTitle = trimNonEmpty(item.sessionTitle);
  if (!time || !sessionTitle) return undefined;

  const speaker = trimNonEmpty(item.speaker);
  const note = trimNonEmpty(item.note);
  return {
    time,
    sessionTitle,
    ...(speaker ? { speaker } : {}),
    ...(note ? { note } : {}),
  };
}

export function normalizeExamTableContext(
  context: ExamTableContext | undefined,
): ExamTableContext | undefined {
  if (!context || !Array.isArray(context.items) || context.items.length === 0) {
    return undefined;
  }

  const title = trimNonEmpty(context.title);
  const location = trimNonEmpty(context.location);
  const date = trimNonEmpty(context.date);
  const fee = trimNonEmpty(context.fee);
  if (!title || !location || !date || !fee) return undefined;

  const items: ExamTableItem[] = [];
  for (const item of context.items) {
    const normalizedItem = normalizeTableItem(item);
    if (!normalizedItem) return undefined;
    items.push(normalizedItem);
  }

  return { title, location, date, fee, items };
}

function areTablesEqual(left: ExamTableContext, right: ExamTableContext): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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
  canonicalPart4Table?: ExamTableContext;
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
): { prelude: ExamPartPrelude; canonicalTable?: ExamTableContext } {
  const firstQuestion = questions.find((question) => question.questionNumber === 8);
  const laterQuestions = questions.filter((question) => question.questionNumber !== 8);
  const canonicalTable = normalizeExamTableContext(firstQuestion?.tableContext);

  if (!firstQuestion?.tableContext) {
    const hasLaterTable = laterQuestions.some((question) => question.tableContext !== undefined);
    return {
      prelude: invalidPrelude(
        4,
        hasLaterTable ? "misplaced-part4-table" : "missing-part4-table",
      ),
    };
  }
  if (!canonicalTable) {
    return { prelude: invalidPrelude(4, "invalid-part4-table") };
  }

  for (const question of laterQuestions) {
    if (question.tableContext === undefined) continue;
    const repeatedTable = normalizeExamTableContext(question.tableContext);
    if (!repeatedTable) {
      return { prelude: invalidPrelude(4, "invalid-part4-table") };
    }
    if (!areTablesEqual(canonicalTable, repeatedTable)) {
      return { prelude: invalidPrelude(4, "conflicting-part4-table") };
    }
  }

  return {
    prelude: {
      kind: "part4-reading",
      partNumber: 4,
      tableContext: canonicalTable,
      durationSec: PART4_READING_DURATION_SEC,
    },
    canonicalTable,
  };
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
    ...(part4Normalization.canonicalTable
      ? { canonicalPart4Table: part4Normalization.canonicalTable }
      : {}),
  };
}
