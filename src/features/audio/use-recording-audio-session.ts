import { setIsAudioActiveAsync } from "expo-audio";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

interface UseRecordingAudioSessionInput {
  /** 세션을 잡고 있어야 하는 구간. 보통 `useIsScreenActive()`를 그대로 넘긴다. */
  isActive: boolean;
  suspendRecording: () => Promise<void>;
}

/**
 * iOS의 전역 AVAudioSession을 녹음 화면이 focus·foreground인 동안 유지한다.
 * 전환을 직렬화해 늦게 끝난 background 정리가 foreground 재활성화를 덮지 않게 한다.
 *
 * player의 `pause()`가 거는 100ms 지연 비활성화에 세션 수명을 맡기지 않기 위한 짝이다.
 * 각 player는 `keepAudioSessionActive: true`로 그 예약을 끄고, 반납 시점은 이 훅이 정한다.
 * 배경은 docs/decisions/2026-08-21-ios-시험-오디오-세션.md.
 */
export function useRecordingAudioSession({
  isActive,
  suspendRecording,
}: UseRecordingAudioSessionInput): void {
  const transitionSequenceRef = useRef(0);
  const desiredActiveRef = useRef(isActive);
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
            console.error("[RecordingAudioSession] 비활성화 전 녹음 정리 실패", error);
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
        `[RecordingAudioSession] 오디오 세션 ${shouldBeActive ? "활성화" : "비활성화"} 실패`,
        error,
      );
    });
  }, []);

  useEffect(() => {
    enqueueTransition(isActive);
  }, [enqueueTransition, isActive]);

  useEffect(
    () => () => {
      enqueueTransition(false);
    },
    [enqueueTransition],
  );
}
