import { setIsAudioActiveAsync } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

interface UseExamAudioSessionInput {
  isExamActive: boolean;
  suspendRecording: () => Promise<void>;
}

/**
 * iOS의 전역 AVAudioSession을 focus된 시험 화면이 foreground에 있는 동안 유지한다.
 * 전환을 직렬화해 늦게 끝난 background 정리가 foreground 재활성화를 덮지 않게 한다.
 */
export function useExamAudioSession({
  isExamActive,
  suspendRecording,
}: UseExamAudioSessionInput): void {
  const transitionSequenceRef = useRef(0);
  const desiredActiveRef = useRef(isExamActive);
  const suspendRecordingRef = useRef(suspendRecording);
  const transitionQueueRef = useRef<Promise<void>>(Promise.resolve());
  suspendRecordingRef.current = suspendRecording;

  const enqueueTransition = useCallback((shouldBeActive: boolean) => {
    desiredActiveRef.current = shouldBeActive;
    transitionSequenceRef.current += 1;
    const transitionSequence = transitionSequenceRef.current;

    const transition = transitionQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (Platform.OS !== "ios") return;

        if (!shouldBeActive) {
          try {
            await suspendRecordingRef.current();
          } catch (error) {
            // 정리가 일부 실패해도 background/이탈 시 전역 세션은 best-effort로 끈다.
            console.error("[ExamAudioSession] 비활성화 전 녹음 정리 실패", error);
          }
        }

        const isStillCurrent =
          transitionSequenceRef.current === transitionSequence &&
          desiredActiveRef.current === shouldBeActive;
        if (!isStillCurrent) return;

        await setIsAudioActiveAsync(shouldBeActive);
      });

    transitionQueueRef.current = transition.catch((error: unknown) => {
      console.error(
        `[ExamAudioSession] 오디오 세션 ${shouldBeActive ? "활성화" : "비활성화"} 실패`,
        error,
      );
    });
  }, []);

  useEffect(() => {
    enqueueTransition(isExamActive);
  }, [enqueueTransition, isExamActive]);

  useEffect(
    () => () => {
      enqueueTransition(false);
    },
    [enqueueTransition],
  );
}
