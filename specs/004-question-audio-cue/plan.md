# 문제 음성 재생 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 3·4·5 문항에서 서버가 제공한 질문 오디오를 준비 시간 시작 전에 재생하고, 질문 오디오가 없는 시험은 응시 전에 차단한다.

**Architecture:** 응시 상태 기계(`use-exam-session-controller`)에 `question-cue` phase를 새로 넣어 `preparation-cue` 바로 앞에 놓는다. 네 개의 문항 진입 경로가 모두 `enterPreparationCue` 하나로 수렴하므로, 이 함수를 감싸는 `enterQuestionStart` 분기 하나만 추가하면 모든 경로가 새 단계를 지난다. 질문 오디오 주소 검증은 `mapExamSession` 시점에 일괄 수행하고, 실패 시 예외를 던져 음향 테스트 화면의 기존 오류 경로로 떨어뜨린다.

**Tech Stack:** Expo 57 / React Native 0.86 / TypeScript(strict) / expo-audio / NativeWind

## Global Constraints

- 패키지 매니저는 `pnpm`을 쓴다. npm·Yarn 락파일을 만들지 않는다.
- 새 의존성을 추가하지 않는다. 이 기능은 이미 설치된 `expo-audio`만으로 구현된다.
- React Native의 `Text`·`Pressable` 대신 `@/components/ui/Text`, `@/components/ui/Pressable`을 쓴다.
- Jua 폰트는 단일 웨이트다. `font-medium`·`font-bold`를 쓰지 않는다.
- 색상·간격은 하드코딩하지 않고 `@/theme`의 토큰 export를 쓴다.
- 애플리케이션 코드는 `@/*` alias로 import한다.
- strict TypeScript를 유지한다. `any`, 안전하지 않은 캐스트, 타입 억제를 쓰지 않는다.
- `Raw* -> mapper -> domain type` 경계를 지킨다. 서버 응답의 불안정한 형태는 mapper에서 정규화한다.
- 자동화 테스트 러너가 없다. 모든 코드 변경은 `pnpm lint`와 `pnpm exec tsc --noEmit`로 검증한다.
- 파트별 준비 시간과 답변 시간 값을 바꾸지 않는다(FR 대상 아님, SC-007).
- Part 4 문항의 질문 텍스트를 화면에 노출하지 않는다(FR-018).
- 질문 오디오 누락을 이유로 새 시험 세션을 자동으로 다시 요청하지 않는다(FR-011).
- 커밋 제목과 본문은 한국어로 쓰고, Conventional Commit 타입과 스코프만 소문자 영어로 둔다.

## File Structure

**신규**

- `src/features/exam/question-audio.ts` — 질문 오디오의 파트별 필수 여부, 주소 판정, 재생 소스 변환, 반복 횟수, 세션 검증과 전용 오류 타입. 질문 오디오에 관한 규칙을 한 곳에 모은다.
- `src/screens/mock-exam/components/ExamQuestionCue.tsx` — 질문 오디오 재생과 반복, 재생 실패 복구 UI를 담당하는 표시 컴포넌트.

**수정**

- `src/features/exam/map-exam-session.ts` — 매핑 진입 시 질문 오디오 검증 호출.
- `src/screens/mock-exam/SoundTestScreen.tsx` — 질문 오디오 오류를 별도 메시지로 안내.
- `src/screens/mock-exam/hooks/use-exam-session-controller.ts` — `question-cue` phase 추가, 진입 분기, 완료 처리.
- `src/screens/mock-exam/ExamSessionScreen.tsx` — `question-cue` 단계의 렌더 배선.

**변경하지 않음**

- `src/screens/mock-exam/components/ExamQuestionContent.tsx` — Part 4 텍스트 숨김을 그대로 유지해야 하므로 손대지 않는다.
- `src/features/exam/part-meta.ts` — 준비·답변 시간은 그대로 둔다.
- `src/features/exam/exam-cue.ts`, `ExamPhaseCue.tsx` — 준비·응답 안내 음성 흐름은 그대로 둔다.
- `src/screens/mock-exam/components/ExamAnswerStatus.tsx` — `ExamSessionPhase`를 쓰는 유일한 외부 소비자다. 다만 phase를 `if` 연쇄로 분기하고 마지막에 `return null`로 끝나므로, `question-cue`가 추가돼도 컴파일 오류 없이 아무것도 표시하지 않는다. 질문 오디오 재생 중에는 답변 상태를 알릴 내용이 없으므로 이 동작이 의도한 결과다.

---

### Task 1: 질문 오디오 규칙 모듈

질문 오디오에 대한 모든 판정을 담는 순수 모듈을 만든다. React 의존이 없어 다른 태스크가 자유롭게 가져다 쓴다.

**Files:**
- Create: `src/features/exam/question-audio.ts`

**Interfaces:**
- Consumes: `ExamQuestion`, `RawExamSession` (from `@/types/exam`), `AudioSource` (type-only, from `expo-audio`)
- Produces:
  - `requiresQuestionAudio(partNumber: number): boolean`
  - `isSupportedQuestionAudioUrl(audioUrl: string): boolean`
  - `getQuestionAudioSource(audioUrl: string): AudioSource | undefined`
  - `getQuestionAudioPlayCount(partNumber: number, isLastInPart: boolean): number`
  - `getPlayableQuestionAudioUrl(question: ExamQuestion): string | undefined`
  - `assertQuestionAudioAvailable(session: RawExamSession): void`
  - `class ExamQuestionAudioError extends Error` — `readonly examId: string`, `readonly issues: readonly ExamQuestionAudioIssue[]`
  - `interface ExamQuestionAudioIssue` — `{ questionNumber: number; partNumber: number; reason: "missing" | "unsupported" }`

- [ ] **Step 1: 모듈 작성**

`src/features/exam/question-audio.ts`:

```ts
import type { AudioSource } from "expo-audio";

import type { ExamQuestion, RawExamSession } from "@/types/exam";

/**
 * 질문 오디오가 반드시 제공되어야 하는 파트.
 * Part 1은 지문이, Part 2는 사진이 화면에 표시되므로 질문 음성이 필요 없다.
 * Part 4는 질문 텍스트를 화면에 표시하지 않아 음성이 유일한 확인 수단이다.
 */
const QUESTION_AUDIO_REQUIRED_PARTS: ReadonlySet<number> = new Set([3, 4, 5]);

/** Part 4 마지막 문항(Q10)은 실제 시험과 동일하게 질문 오디오를 두 번 들려준다. */
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
```

- [ ] **Step 2: 정적 검사**

```sh
pnpm exec tsc --noEmit
pnpm lint
```

기대 결과: `question-audio.ts`에 대한 오류·경고 없음. `src/screens/home/HomeScreen.tsx`의 `DebugGrid` 미사용 경고는 이 브랜치 이전부터 있던 것이므로 그대로 남아 있어도 정상이다.

- [ ] **Step 3: 커밋**

```sh
git add src/features/exam/question-audio.ts
git commit -m "feat(mock-exam): 질문 오디오 판정 규칙 모듈 추가"
```

---

### Task 2: 세션 생성 시점 차단

질문 오디오가 갖춰지지 않은 세션을 응시 화면에 넘기지 않는다. 검증 호출과 사용자 안내를 함께 넣어야 흐름이 완성되므로 한 태스크로 묶는다.

**Files:**
- Modify: `src/features/exam/map-exam-session.ts:1-13`
- Modify: `src/screens/mock-exam/SoundTestScreen.tsx:1-20`, `src/screens/mock-exam/SoundTestScreen.tsx:75-79`

**Interfaces:**
- Consumes: `assertQuestionAudioAvailable`, `ExamQuestionAudioError` (Task 1)
- Produces: 없음. 기존 `createExamSession` 시그니처는 그대로다.

- [ ] **Step 1: 매퍼에 검증 연결**

`src/features/exam/map-exam-session.ts`의 import 블록에 다음 줄을 추가한다:

```ts
import { assertQuestionAudioAvailable } from "@/features/exam/question-audio";
```

그리고 `mapExamSession` 본문의 첫 줄로 호출을 넣는다. `normalizeExamPartPreludes`보다 먼저 두는 이유는, 질문 오디오 누락은 응시 자체를 막는 조건이라 파트 사전 정보 판정보다 우선해야 하기 때문이다:

```ts
export function mapExamSession(raw: RawExamSession): ExamSession {
  assertQuestionAudioAvailable(raw);

  const { partPreludes, canonicalPart4Table } = normalizeExamPartPreludes(raw.questions);
```

- [ ] **Step 2: 음향 테스트 화면에 안내 추가**

`src/screens/mock-exam/SoundTestScreen.tsx`의 import 블록에 다음 줄을 추가한다:

```ts
import { ExamQuestionAudioError } from "@/features/exam/question-audio";
```

`handleStartExam`의 `catch` 블록을 아래로 교체한다. 기존 `startExamError` 상태와 표시 경로를 그대로 쓰므로 새 UI는 없다:

```ts
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ExamQuestionAudioError) {
        console.error("[SoundTest] 문제 음성이 없어 응시를 차단", {
          examId: error.examId,
          issues: error.issues,
        });
        setStartExamError("문제 음성이 준비되지 않은 시험이에요. 다시 시도해주세요.");
        return;
      }
      console.error("[SoundTest] 모의고사 세션 생성 실패", error);
      setStartExamError("시험 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
```

`return`을 써도 `finally`는 실행되므로 `createRequestRef`와 `isStartingExam` 정리는 그대로 동작한다.

- [ ] **Step 3: 정적 검사**

```sh
pnpm exec tsc --noEmit
pnpm lint
```

기대 결과: 신규 오류 없음.

- [ ] **Step 4: 차단 동작 수동 확인**

`mapExamSession`의 `assertQuestionAudioAvailable(raw);` 바로 앞에 임시 코드를 넣어 누락 상황을 만든다:

```ts
  // 임시 검증용 — 확인 후 반드시 제거한다
  raw.questions = raw.questions.map((q) => (q.part === 4 ? { ...q, audioUrl: undefined } : q));
```

`pnpm ios`(또는 `pnpm android`)로 앱을 띄우고 모의고사 → 마이크 테스트 → 음향 테스트 → 시험 시작을 누른다.

기대 결과:
1. 응시 화면으로 이동하지 않는다.
2. 음향 테스트 화면에 "문제 음성이 준비되지 않은 시험이에요. 다시 시도해주세요."가 표시된다.
3. 콘솔에 `[SoundTest] 문제 음성이 없어 응시를 차단`과 함께 `examId`, Part 4 문항 번호 3개, `reason: "missing"`이 찍힌다.
4. 세션 생성 요청이 자동으로 다시 나가지 않는다.
5. "시험 시작"을 다시 누르면 그때 요청이 한 번 더 나간다.

확인 후 임시 코드를 반드시 제거하고 다시 실행해 정상 진입을 확인한다.

- [ ] **Step 5: 커밋**

```sh
git add src/features/exam/map-exam-session.ts src/screens/mock-exam/SoundTestScreen.tsx
git commit -m "feat(mock-exam): 질문 오디오 누락 시 응시 시작 차단"
```

---

### Task 3: 질문 오디오 재생 컴포넌트

재생·반복·복구를 담당하는 표시 컴포넌트를 만든다. 이 태스크에서는 아직 어디서도 쓰이지 않으며 Task 4에서 배선된다.

**Files:**
- Create: `src/screens/mock-exam/components/ExamQuestionCue.tsx`

**Interfaces:**
- Consumes: `getQuestionAudioSource` (Task 1), `PLAYBACK_AUDIO_MODE` (from `@/features/exam/answer-audio`)
- Produces: `ExamQuestionCue` — props `{ audioUrl: string; isActive: boolean; playCount: number; onComplete: () => void; onExit: () => void }`

- [ ] **Step 1: 컴포넌트 작성**

`src/screens/mock-exam/components/ExamQuestionCue.tsx`:

```tsx
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { PLAYBACK_AUDIO_MODE } from "@/features/exam/answer-audio";
import { getQuestionAudioSource } from "@/features/exam/question-audio";
import { colors } from "@/theme";

interface ExamQuestionCueProps {
  audioUrl: string;
  isActive: boolean;
  /** 재생 횟수. Part 4 마지막 문항만 2회다. */
  playCount: number;
  onComplete: () => void;
  onExit: () => void;
}

export function ExamQuestionCue({
  audioUrl,
  isActive,
  playCount,
  onComplete,
  onExit,
}: ExamQuestionCueProps) {
  const audioSource = useMemo(() => getQuestionAudioSource(audioUrl), [audioUrl]);
  const player = useAudioPlayer(audioSource ?? null, { updateInterval: 100 });
  const playbackStatus = useAudioPlayerStatus(player);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [playedCount, setPlayedCount] = useState(0);
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const hasObservedPlayingRef = useRef(false);
  const isActiveRef = useRef(isActive);

  const playFromStart = useCallback(
    async (reloadSource = false) => {
      if (!audioSource || !isActiveRef.current || hasCompletedRef.current) {
        if (!audioSource) setHasPlaybackError(true);
        return;
      }

      try {
        hasObservedPlayingRef.current = false;
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.pause();
        if (reloadSource) {
          player.replace(audioSource);
        } else if (player.currentTime > 0) {
          await player.seekTo(0);
        }
        setPlayedCount(0);
        player.play();
        setHasPlaybackError(false);
        hasStartedRef.current = true;
        shouldRestartRef.current = false;
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 재생 실패", error);
        setHasPlaybackError(true);
      }
    },
    [audioSource, player],
  );

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      player.pause();
      hasObservedPlayingRef.current = false;
      if (hasStartedRef.current && !hasCompletedRef.current) {
        shouldRestartRef.current = true;
      }
      return;
    }

    if (!hasStartedRef.current || shouldRestartRef.current) {
      void playFromStart();
    }
  }, [isActive, playFromStart, player]);

  useEffect(() => {
    if (playbackStatus.playing && isActive) {
      hasObservedPlayingRef.current = true;
    }
  }, [isActive, playbackStatus.playing]);

  useEffect(() => {
    if (playbackStatus.error === null && !playbackStatus.mediaServicesDidReset) return;
    player.pause();
    hasObservedPlayingRef.current = false;
    shouldRestartRef.current = true;
    setHasPlaybackError(true);
  }, [playbackStatus.error, playbackStatus.mediaServicesDidReset, player]);

  const hasFinished =
    playbackStatus.didJustFinish ||
    (playbackStatus.duration > 0 && playbackStatus.currentTime >= playbackStatus.duration);

  useEffect(() => {
    if (
      !isActive ||
      !hasFinished ||
      !hasObservedPlayingRef.current ||
      hasPlaybackError ||
      hasCompletedRef.current
    ) {
      return;
    }

    // 재생이 관측된 뒤에만 한 회차로 센다. 여기서 내려두면 다음 회차가 실제로
    // 재생되기 전까지 이 effect가 다시 진입하지 못해 중복 집계가 막힌다.
    hasObservedPlayingRef.current = false;
    const nextPlayedCount = playedCount + 1;
    setPlayedCount(nextPlayedCount);

    if (nextPlayedCount >= playCount) {
      hasCompletedRef.current = true;
      player.pause();
      onComplete();
      return;
    }

    void (async () => {
      try {
        await player.seekTo(0);
        if (!isActiveRef.current || hasCompletedRef.current) return;
        player.play();
      } catch (error) {
        console.error("[ExamQuestionCue] 문제 음성 반복 재생 실패", error);
        setHasPlaybackError(true);
      }
    })();
  }, [
    hasFinished,
    hasPlaybackError,
    isActive,
    onComplete,
    playCount,
    playedCount,
    player,
  ]);

  if (hasPlaybackError) {
    return (
      <View className="w-full gap-3 rounded-2xl border border-exam-dangerLine bg-surface p-4">
        <View
          accessibilityLiveRegion="assertive"
          className="flex-row items-center justify-center gap-2"
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color={colors.exam.danger}
          />
          <Text className="text-sm text-exam-danger">문제 음성을 재생하지 못했어요</Text>
        </View>
        <View className="flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl border border-brand-300 bg-surface py-3"
            onPress={() => {
              void playFromStart(true);
            }}
          >
            <Text className="text-sm text-brand-text">처음부터 다시 듣기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="flex-1 items-center rounded-2xl bg-brand-cta py-3"
            onPress={onExit}
          >
            <Text className="text-sm text-white">시험 나가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 py-1">
      <MaterialCommunityIcons name="volume-high" size={20} color={colors.brand.text} />
      <Text className="text-sm text-brand-text">
        {playCount > 1
          ? `문제 음성을 듣고 있어요 (${Math.min(playedCount + 1, playCount)}/${playCount})`
          : "문제 음성을 듣고 있어요"}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: 정적 검사**

```sh
pnpm exec tsc --noEmit
pnpm lint
```

기대 결과: 신규 오류 없음. 이 컴포넌트는 아직 import되지 않지만 export되어 있으므로 미사용 경고는 나지 않는다.

- [ ] **Step 3: 커밋**

```sh
git add src/screens/mock-exam/components/ExamQuestionCue.tsx
git commit -m "feat(mock-exam): 문제 음성 재생 컴포넌트 추가"
```

---

### Task 4: 응시 흐름에 질문 오디오 단계 배선

상태 기계에 `question-cue`를 넣고 화면에 연결해 재생 흐름을 완성한다. 컨트롤러와 화면을 나누면 중간 상태에서 응시가 멈추므로 한 태스크로 묶는다.

**Files:**
- Modify: `src/screens/mock-exam/hooks/use-exam-session-controller.ts:16-31`, `:80-88`, `:110-115`, `:258-275`, `:378-396`
- Modify: `src/screens/mock-exam/ExamSessionScreen.tsx:14-28`, `:41-59`, `:236-247`

**Interfaces:**
- Consumes: `getPlayableQuestionAudioUrl`, `getQuestionAudioPlayCount` (Task 1), `ExamQuestionCue` (Task 3)
- Produces: 컨트롤러 반환값에 `completeQuestionCue: () => void`와 `questionAudioUrl: string | undefined` 추가

- [ ] **Step 1: phase 타입에 단계 추가**

`use-exam-session-controller.ts`의 `ExamSessionPhase` 유니온에서 `"part-prelude-error"` 다음 줄에 추가한다:

```ts
  | "part-prelude-error"
  | "question-cue"
  | "preparation-cue"
```

- [ ] **Step 2: 컨트롤러 import 추가**

```ts
import {
  getPlayableQuestionAudioUrl,
} from "@/features/exam/question-audio";
```

- [ ] **Step 3: 문항 진입 분기 추가**

`enterPreparationCue` 정의 바로 아래에 `enterQuestionStart`를 추가한다. 준비 시간 값은 `question-cue`를 벗어날 때 설정되므로 여기서는 phase만 바꾼다:

```ts
  /**
   * 문항 진입 지점. 재생할 질문 오디오가 있으면 준비 안내보다 먼저 듣게 한다.
   * Part 1·2는 항상 undefined라 기존 흐름 그대로 준비 안내로 간다.
   */
  const enterQuestionStart = useCallback(
    (activeQuestion: ExamQuestion) => {
      if (getPlayableQuestionAudioUrl(activeQuestion)) {
        updatePhase("question-cue");
        return;
      }
      enterPreparationCue(activeQuestion);
    },
    [enterPreparationCue, updatePhase],
  );
```

- [ ] **Step 4: 네 개의 진입 경로를 새 분기로 교체**

`enterPreparationCue(...)` 호출 네 곳을 `enterQuestionStart(...)`로 바꾸고 각 `useCallback`의 의존성 배열도 함께 바꾼다.

`advanceAfterRegistration`:

```ts
    } else {
      enterQuestionStart(nextQuestion);
    }
  }, [enterQuestionStart, session.questions, updatePhase]);
```

`completeDirections`의 마지막 줄과 의존성:

```ts
    enterQuestionStart(question);
  }, [enterQuestionStart, partPrelude, question, updatePhase]);
```

`completePart3Intro`:

```ts
  const completePart3Intro = useCallback(() => {
    if (phaseRef.current !== "part3-intro" || !question) return;
    completedPartPreludesRef.current.add(question.partNumber);
    enterQuestionStart(question);
  }, [enterQuestionStart, question]);
```

`completePart4Reading`:

```ts
  const completePart4Reading = useCallback(() => {
    if (phaseRef.current !== "part4-reading" || !question) return;
    completedPartPreludesRef.current.add(question.partNumber);
    readingRemainingMsRef.current = 0;
    setReadingRemainingMs(0);
    enterQuestionStart(question);
  }, [enterQuestionStart, question]);
```

- [ ] **Step 5: 완료 처리와 반환값 추가**

`completePart4Reading` 다음에 추가한다:

```ts
  const completeQuestionCue = useCallback(() => {
    if (phaseRef.current !== "question-cue" || !question) return;
    enterPreparationCue(question);
  }, [enterPreparationCue, question]);
```

`partPrelude` 계산 아래에 현재 문항의 재생 주소를 둔다. 화면과 컨트롤러가 같은 값을 보게 해 서로 어긋나지 않게 한다:

```ts
  const questionAudioUrl = question ? getPlayableQuestionAudioUrl(question) : undefined;
```

반환 객체에 두 항목을 추가한다:

```ts
    questionAudioUrl,
    completeQuestionCue,
```

- [ ] **Step 6: 화면에 컴포넌트 배선**

`ExamSessionScreen.tsx`의 import에 추가한다:

```ts
import { getQuestionAudioPlayCount } from "@/features/exam/question-audio";
import { ExamQuestionCue } from "@/screens/mock-exam/components/ExamQuestionCue";
```

컨트롤러 구조 분해에 두 항목을 추가한다:

```ts
    questionAudioUrl,
    completeQuestionCue,
```

하단 컨트롤 영역에서 `activeCueKind` 블록 **앞에** 다음을 넣는다. `showTimer` 목록은 건드리지 않으므로 이 단계에서는 타이머가 표시되지 않는다:

```tsx
              {phase === "question-cue" && questionAudioUrl ? (
                <ExamQuestionCue
                  audioUrl={questionAudioUrl}
                  isActive={isExamActive}
                  playCount={getQuestionAudioPlayCount(
                    question.partNumber,
                    question.isLastInPart,
                  )}
                  onComplete={completeQuestionCue}
                  onExit={handleExitExam}
                />
              ) : null}
```

- [ ] **Step 7: 정적 검사**

```sh
pnpm exec tsc --noEmit
pnpm lint
```

기대 결과: 신규 오류 없음. `enterPreparationCue`는 `enterQuestionStart`와 `completeQuestionCue`에서 계속 쓰이므로 미사용 경고가 나지 않는다.

- [ ] **Step 8: 커밋**

```sh
git add src/screens/mock-exam/hooks/use-exam-session-controller.ts src/screens/mock-exam/ExamSessionScreen.tsx
git commit -m "feat(mock-exam): 준비 안내 전 문제 음성 재생 단계 연결"
```

---

### Task 5: 수동 QA와 마무리

자동화 테스트 러너가 없으므로 사용자 시나리오를 기기에서 직접 확인한다.

**Files:**
- Modify: 없음(문제 발견 시에만 해당 파일 수정)

- [ ] **Step 1: 서버 계약 확인**

`map-exam-session.ts`의 `mapExamSession` 첫 줄에 임시 로그를 넣고 시험을 시작한다:

```ts
  console.log("[mapExamSession] 문항별 오디오", raw.questions.map((q) => ({
    part: q.part,
    questionNumber: q.questionNumber,
    hasAudioUrl: Boolean(q.audioUrl),
  })));
```

기대 결과: Part 3·4·5 문항 7개 모두 `hasAudioUrl: true`. 스펙의 Assumptions에 기록한 미확인 가정이 이 단계에서 확인된다. **Part 3·4·5에 `false`가 하나라도 있으면 여기서 멈추고 백엔드와 계약을 확인한다.** 확인 후 임시 로그를 제거한다.

- [ ] **Step 2: 정상 재생 확인 (US1)**

Part 3 Q5~Q7을 응시한다.

기대 결과:
1. Part 3 상황 설명 음성이 끝난 뒤 질문 음성이 재생된다.
2. 질문 음성이 재생되는 동안 "문제 음성을 듣고 있어요"가 표시되고 **타이머 카드가 보이지 않는다**.
3. 질문 음성이 끝난 뒤에 빕 소리와 "Begin preparing now"가 재생된다.
4. 그 뒤 3초 카운트다운이 시작된다.
5. 3초가 끝나면 빕 소리와 "Begin responding now"가 재생되고 녹음이 시작된다.
6. Q6·Q7에서도 문항마다 질문 음성이 처음부터 재생된다.

- [ ] **Step 3: Part 4 반복 재생 확인 (US2)**

Part 4 Q8~Q10을 응시한다.

기대 결과:
1. 정보 읽기 45초가 끝난 뒤 Q8에서 질문 음성이 **한 번** 재생된다.
2. Q9도 한 번 재생된다.
3. Q10에서 질문 음성이 **연속으로 두 번** 재생되고, 표시가 `(1/2)`에서 `(2/2)`로 바뀐다.
4. 2회차가 끝난 뒤에만 준비 안내로 넘어간다.
5. Part 4 전 문항에서 질문 텍스트가 화면에 표시되지 않는다.

- [ ] **Step 4: Part 1·2·5 확인 (US5)**

Part 1·2와 Part 5를 응시한다.

기대 결과:
1. Part 1·2는 질문 음성 없이 곧바로 빕 소리와 준비 안내가 나오고 45초 카운트다운이 시작된다.
2. Part 5는 질문 음성이 재생된 뒤 준비 안내가 나오고 45초 카운트다운이 시작된다.
3. 파트별 준비·답변 시간이 가이드 화면의 값과 일치한다.

- [ ] **Step 5: 재생 실패 복구 확인 (US4)**

`question-audio.ts`의 `getPlayableQuestionAudioUrl`이 돌려주는 주소를 임시로 깨뜨린다:

```ts
  return `${audioUrl}.broken`; // 임시 검증용 — 확인 후 반드시 제거한다
```

Part 3 문항에 진입한다.

기대 결과:
1. "문제 음성을 재생하지 못했어요"와 함께 다시 듣기·시험 나가기 버튼이 표시된다.
2. **준비 시간 카운트다운이 시작되지 않는다.** 타이머 카드가 보이지 않는다.
3. 녹음이 시작되지 않는다.
4. "시험 나가기"를 누르면 기존 이탈 흐름과 동일하게 동작한다.

임시 코드를 제거하고 다시 진입해 "처음부터 다시 듣기"가 정상 재생으로 이어지는지 확인한다.

- [ ] **Step 6: 백그라운드 전환 확인 (Edge Cases)**

Part 4 Q10의 질문 음성 1회차가 재생되는 도중 앱을 배경으로 보냈다가 다시 활성화한다.

기대 결과:
1. 배경으로 가는 즉시 재생이 멈춘다.
2. 다시 활성화하면 **1회차부터** 재생된다. 표시가 `(1/2)`로 돌아간다.
3. 그동안 준비 시간이 시작되지 않는다.

- [ ] **Step 7: 최종 검증**

```sh
git status --short
pnpm exec tsc --noEmit
pnpm lint
```

기대 결과: 임시 검증 코드가 하나도 남아 있지 않고, 워킹트리에 의도한 변경만 있으며, 두 명령 모두 신규 오류 없이 끝난다.

- [ ] **Step 8: 스펙 대조**

`specs/004-question-audio-cue/spec.md`의 FR-001~FR-018과 SC-001~SC-007을 하나씩 읽으며 위 시나리오에서 확인된 항목을 대조한다. 확인하지 못한 항목이 있으면 그 항목을 검증할 시나리오를 추가로 수행한다.

---

## Self-Review

**스펙 커버리지**

| 요구사항 | 담당 태스크 |
|---|---|
| FR-001, FR-005 | Task 4 (진입 분기, 완료 처리) |
| FR-002, FR-007 | Task 1 (`getPlayableQuestionAudioUrl`, `getQuestionAudioPlayCount`) |
| FR-003, FR-004 | Task 4 (`question-cue`를 `showTimer` 목록에 넣지 않음) |
| FR-006 | Task 1 + Task 3 (반복 재생 루프) |
| FR-008, FR-009 | Task 1 + Task 2 (`assertQuestionAudioAvailable`, 매퍼 호출) |
| FR-010, FR-011 | Task 2 (기존 `startExamError` 재사용, 자동 재요청 없음) |
| FR-012 | Task 2 (`examId`·문항 번호·사유 로그) |
| FR-013, FR-014 | Task 3 (복구 UI, `playFromStart`가 `playedCount`를 0으로 되돌림) |
| FR-015 | Task 3 (`isActive` effect, `shouldRestartRef`) |
| FR-016 | Task 3 (`isActive` false에서 `player.pause()`) |
| FR-017 | Task 4 (녹음은 `response-cue` 이후에만 시작) |
| FR-018 | `ExamQuestionContent.tsx` 미변경 + Task 5 Step 3 확인 |
| SC-001~SC-007 | Task 5 |

**미해결 위험**

- 서버가 Part 3·4·5에 질문 오디오 주소를 보내는지는 확인된 적이 없다. Task 5 Step 1이 이를 가장 먼저 확인하며, 여기서 어긋나면 이후 태스크의 수동 검증이 성립하지 않는다.
- 원격 오류 수집 도구가 없어 FR-012의 진단 기록은 개발 빌드 콘솔에서만 확인된다.
