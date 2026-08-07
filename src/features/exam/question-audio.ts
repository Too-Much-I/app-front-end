import type { AudioSource } from "expo-audio";

import type { ExamQuestion, RawExamSession } from "@/types/exam";

/**
 * 질문 오디오가 반드시 제공되어야 하는 파트.
 * Part 1은 지문이, Part 2는 사진이 화면에 표시되므로 질문 음성이 필요 없다.
 * Part 4는 질문 텍스트를 화면에 표시하지 않아 음성이 유일한 확인 수단이다.
 */
const QUESTION_AUDIO_REQUIRED_PARTS: ReadonlySet<number> = new Set([3, 4, 5]);

/**
 * Part 4 마지막 문항(Q10)은 실제 시험과 동일하게 질문 오디오를 두 번 들려준다.
 * 두 회차 사이에는 `ExamQuestionCue`가 "Now listen again." 안내를 끼워 넣는다
 * (`getExamListenAgainCueSource`).
 */
const PART4_LAST_QUESTION_PLAY_COUNT = 2;

export type ExamQuestionAudioIssueReason = "missing" | "unsupported";

export interface ExamQuestionAudioIssue {
  questionNumber: number;
  partNumber: number;
  reason: ExamQuestionAudioIssueReason;
}

/**
 * 응시에 필요한 질문 오디오가 갖춰지지 않은 세션임을 알린다.
 * 응시 도중이 아니라 세션을 받아온 시점에 던져, 답변을 한 건도 잃지 않게 한다.
 */
export class ExamQuestionAudioError extends Error {
  readonly examId: string;
  readonly issues: readonly ExamQuestionAudioIssue[];

  constructor(examId: string, issues: readonly ExamQuestionAudioIssue[]) {
    super(`질문 오디오를 사용할 수 없는 문항이 ${issues.length}개 있습니다.`);
    this.name = "ExamQuestionAudioError";
    this.examId = examId;
    this.issues = issues;
  }
}

export function requiresQuestionAudio(partNumber: number): boolean {
  return QUESTION_AUDIO_REQUIRED_PARTS.has(partNumber);
}

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Part 3 안내 음성(`isSupportedExamPartIntroAudioUrl`)과 같은 기준을 쓰되 번들 자원은 받지 않는다.
 * 질문 오디오는 시험마다 내용이 달라 앱에 포함될 수 없고 원격 주소로만 온다.
 */
export function isSupportedQuestionAudioUrl(audioUrl: string): boolean {
  return /^https?:\/\//i.test(audioUrl);
}

export function getQuestionAudioSource(audioUrl: string): AudioSource | undefined {
  return isSupportedQuestionAudioUrl(audioUrl) ? { uri: audioUrl } : undefined;
}

/** 질문 오디오를 몇 번 재생할지. Part 4 마지막 문항만 2회다. */
export function getQuestionAudioPlayCount(
  partNumber: number,
  isLastInPart: boolean,
): number {
  return partNumber === 4 && isLastInPart ? PART4_LAST_QUESTION_PLAY_COUNT : 1;
}

/**
 * 재생해야 할 질문 오디오 주소를 돌려준다.
 * Part 1·2는 주소가 담겨 오더라도 재생하지 않으므로 항상 undefined다.
 */
export function getPlayableQuestionAudioUrl(
  question: ExamQuestion,
): string | undefined {
  if (!requiresQuestionAudio(question.partNumber)) return undefined;
  const audioUrl = trimNonEmpty(question.audioUrl);
  if (!audioUrl || !isSupportedQuestionAudioUrl(audioUrl)) return undefined;
  return audioUrl;
}

/**
 * Part 3·4·5 전 문항의 질문 오디오 주소를 검사하고, 하나라도 어긋나면 던진다.
 * 부분 응시를 허용하지 않으므로 문제가 있는 문항을 모두 모아 한 번에 보고한다.
 */
export function assertQuestionAudioAvailable(session: RawExamSession): void {
  const issues: ExamQuestionAudioIssue[] = [];

  for (const question of session.questions) {
    if (!requiresQuestionAudio(question.part)) continue;

    const audioUrl = trimNonEmpty(question.audioUrl);
    if (!audioUrl) {
      issues.push({
        questionNumber: question.questionNumber,
        partNumber: question.part,
        reason: "missing",
      });
      continue;
    }
    if (!isSupportedQuestionAudioUrl(audioUrl)) {
      issues.push({
        questionNumber: question.questionNumber,
        partNumber: question.part,
        reason: "unsupported",
      });
    }
  }

  if (issues.length > 0) {
    throw new ExamQuestionAudioError(session.examId, issues);
  }
}
