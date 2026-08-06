import type { AudioSource } from "expo-audio";

import type {
  ExamPartPrelude,
  ExamPartPreludeInvalidReason,
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

function normalizeRemoteImageUrl(value: unknown): string | undefined {
  const url = trimNonEmpty(value);
  return url && /^https?:\/\//i.test(url) ? url : undefined;
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
  canonicalPart4ImageUrl?: string;
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
): { prelude: ExamPartPrelude; canonicalImageUrl?: string } {
  const firstQuestion = questions.find(
    (question) => question.questionNumber === PART4_FIRST_QUESTION_NUMBER,
  );
  const laterQuestions = questions.filter(
    (question) => question.questionNumber !== PART4_FIRST_QUESTION_NUMBER,
  );
  const canonicalImageUrl = normalizeRemoteImageUrl(firstQuestion?.tableImageUrl);

  if (!firstQuestion?.tableImageUrl) {
    const hasLaterImage = laterQuestions.some(
      (question) => question.tableImageUrl !== undefined,
    );
    return {
      prelude: invalidPrelude(
        4,
        hasLaterImage ? "misplaced-part4-image" : "missing-part4-image",
      ),
    };
  }
  if (!canonicalImageUrl) {
    return { prelude: invalidPrelude(4, "invalid-part4-image") };
  }

  for (const question of laterQuestions) {
    if (question.tableImageUrl === undefined) continue;
    const repeatedImageUrl = normalizeRemoteImageUrl(question.tableImageUrl);
    if (!repeatedImageUrl) {
      return { prelude: invalidPrelude(4, "invalid-part4-image") };
    }
    if (repeatedImageUrl !== canonicalImageUrl) {
      return { prelude: invalidPrelude(4, "conflicting-part4-image") };
    }
  }

  return {
    prelude: {
      kind: "part4-reading",
      partNumber: 4,
      tableImageUrl: canonicalImageUrl,
      durationSec: PART4_READING_DURATION_SEC,
    },
    canonicalImageUrl,
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
    ...(part4Normalization.canonicalImageUrl
      ? { canonicalPart4ImageUrl: part4Normalization.canonicalImageUrl }
      : {}),
  };
}
