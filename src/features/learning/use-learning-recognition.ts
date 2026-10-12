import {
  ExpoSpeechRecognitionModule as speech,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { matchLearningSpeechAttempt } from '@/features/learning/learning-speech-match';

type RecognitionDisplay =
  | {
      status: 'idle' | 'preparing' | 'listening' | 'finishing' | 'complete';
      transcript: string;
      message: null;
    }
  | { status: 'retry' | 'unavailable' | 'denied'; transcript: string; message: string };

type RecognitionState = RecognitionDisplay & { matched: readonly boolean[] };
type SpeechMatch = ReturnType<typeof matchLearningSpeechAttempt>;
type SpeechAttempt = { key: string; text: string; confirmed: readonly boolean[] };

// Native service deadlines are recovery guards, not a limit on how long the learner can speak.
const NATIVE_SETUP_TIMEOUT_MS = 12000;
// Let the native terminal event settle before rearming the same sentence's microphone.
const NATIVE_RESTART_DELAY_MS = 150;
async function waitForLearningNative<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Speech service timed out')),
          NATIVE_SETUP_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForLearningForeground(): Promise<void> {
  if (AppState.currentState === 'active') return;
  let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
  try {
    await waitForLearningNative(
      new Promise<void>((resolve) => {
        subscription = AppState.addEventListener('change', (next) => {
          if (next === 'active') resolve();
        });
      }),
    );
  } finally {
    subscription?.remove();
  }
}

/** Wait for the native terminal event before another sentence can own the microphone. */
async function abortLearningRecognition(): Promise<void> {
  if ((await waitForLearningNative(speech.getStateAsync())) === 'inactive') return;
  await new Promise<void>((resolve, reject) => {
    const listener = speech.addListener('end', () => {
      clearTimeout(timer);
      listener.remove();
      resolve();
    });
    const timer = setTimeout(() => {
      listener.remove();
      reject(new Error('Microphone did not stop'));
    }, 3000);
    speech.abort();
  });
}

export function useLearningRecognition(onComplete: () => void) {
  const [state, setState] = useState<RecognitionState>({
    status: 'idle',
    transcript: '',
    matched: [],
    message: null,
  });
  const [inputLevel, setInputLevel] = useState(0);
  const mounted = useRef(true);
  const generation = useRef(0);
  const attempt = useRef<SpeechAttempt | null>(null);
  const active = useRef<{
    id: number;
    text: string;
    key: string;
    baseline: readonly boolean[];
    finalMatch: SpeechMatch | null;
    accepted: boolean;
    finishing: boolean;
    failed: boolean;
  } | null>(null);
  const busy = useRef(false);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resume = useRef<(text: string, key: string) => Promise<void>>(async () => undefined);
  const clearRestart = useCallback(() => {
    if (restart.current) clearTimeout(restart.current);
    restart.current = null;
  }, []);
  const clearWatchdog = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);
  const completion = useRef(onComplete);
  completion.current = onComplete;
  const update = useCallback((next: RecognitionDisplay, matched?: readonly boolean[]) => {
    if (mounted.current) {
      setState({ ...next, matched: matched ?? attempt.current?.confirmed ?? [] });
      if (next.status !== 'listening' && next.status !== 'finishing') setInputLevel(0);
    }
  }, []);
  const clearCompleted = useCallback(() => {
    // Only reset an ended session; never interrupt an active native recognizer.
    if (!mounted.current || active.current) return;
    attempt.current = null;
    setState((previous) =>
      previous.status === 'complete'
        ? { status: 'idle', transcript: '', matched: [], message: null }
        : previous,
    );
  }, []);
  const cancel = useCallback(
    async ({ preserveProgress = false }: { preserveProgress?: boolean } = {}) => {
      generation.current++;
      busy.current = false;
      active.current = null;
      clearWatchdog();
      clearRestart();
      if (!preserveProgress) attempt.current = null;
      update({ status: 'idle', transcript: '', message: null });
      // Also cancel a native start that has not produced a recognition task yet.
      speech.abort();
      await abortLearningRecognition();
    },
    [clearWatchdog, clearRestart, update],
  );

  const armWatchdog = useCallback(
    (id: number) => {
      clearWatchdog();
      watchdog.current = setTimeout(() => {
        if (id !== generation.current) return;
        generation.current++;
        active.current = null;
        busy.current = false;
        clearRestart();
        speech.abort();
        update({
          status: 'unavailable',
          transcript: '',
          message:
            '기기 내 영어 인식이 응답하지 않아요. 다시 시도하거나 실전 연습을 계속할 수 있어요.',
        });
      }, NATIVE_SETUP_TIMEOUT_MS);
    },
    [clearWatchdog, clearRestart, update],
  );

  useSpeechRecognitionEvent('start', () => {
    if (!active.current) {
      speech.abort();
      return;
    }
    clearWatchdog();
    update({ status: 'listening', transcript: '', message: null });
  });
  useSpeechRecognitionEvent('result', (event) => {
    const session = active.current;
    if (!session || session.accepted || session.failed) return;
    // Select one native hypothesis; never combine incompatible alternatives or interim revisions.
    const candidates = event.results.map((result) => ({
      transcript: result.transcript,
      match: matchLearningSpeechAttempt(session.text, result.transcript, session.baseline),
    }));
    const best = candidates.reduce<(typeof candidates)[number] | null>(
      (chosen, candidate) =>
        !chosen || candidate.match.ratio > chosen.match.ratio ? candidate : chosen,
      null,
    );
    if (!best) return;
    const { transcript, match } = best;
    if (event.isFinal) {
      session.finalMatch = match;
      armWatchdog(session.id);
    }
    if (event.isFinal && match.complete) {
      session.accepted = true;
      armWatchdog(session.id);
      update({ status: 'complete', transcript, message: null }, match.matched);
    } else {
      update(
        { status: session.finishing ? 'finishing' : 'listening', transcript, message: null },
        match.matched,
      );
      // Let the learner finish speaking at 70%; only a full match finalizes early.
      // The final native transcript determines whether the 70% threshold is met.
      if (match.fullyMatched && !session.finishing) {
        session.finishing = true;
        armWatchdog(session.id);
        speech.stop();
      }
    }
  });
  useSpeechRecognitionEvent('volumechange', (event) => {
    const session = active.current;
    if (!mounted.current || !session || session.accepted || session.finishing) return;
    // Native volume is -2..10, with values below zero considered inaudible.
    // This drives input feedback only; it must never mark a word as recognized.
    setInputLevel(Number.isFinite(event.value) ? Math.max(0, Math.min(1, event.value / 10)) : 0);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (!active.current) return;
    active.current.accepted = false;
    active.current.failed = true;
    active.current.finalMatch = null;
    armWatchdog(active.current.id);
    const denied = event.error === 'not-allowed';
    const unavailable = [
      'service-not-allowed',
      'language-not-supported',
      'language-unavailable',
      'network',
    ].includes(event.error);
    update({
      status: denied ? 'denied' : unavailable ? 'unavailable' : 'retry',
      transcript: '',
      message: denied
        ? '설정에서 마이크 접근을 허용해 주세요.'
        : unavailable
          ? '기기 내 영어 인식을 사용할 수 없어요. 영어 음성 언어를 준비한 뒤 다시 시도해 주세요.'
          : '마이크를 눌러 빠진 단어부터 이어서 말해 주세요.',
    });
  });
  useSpeechRecognitionEvent('end', () => {
    const session = active.current;
    active.current = null;
    if (!session || session.id !== generation.current) return;
    setInputLevel(0);
    clearWatchdog();
    if (session.failed) return;
    const finalMatch = session.finalMatch;
    if (finalMatch) {
      attempt.current = { key: session.key, text: session.text, confirmed: finalMatch.matched };
    }
    if (session.accepted) {
      completion.current();
      return;
    }
    const addedWords = finalMatch?.matched.some(
      (matched, index) => matched && !session.baseline[index],
    );
    if (addedWords && AppState.currentState === 'active') {
      update({ status: 'preparing', transcript: '', message: null });
      restart.current = setTimeout(() => {
        restart.current = null;
        if (
          !mounted.current ||
          generation.current !== session.id ||
          AppState.currentState !== 'active'
        )
          return;
        void resume.current(session.text, session.key);
      }, NATIVE_RESTART_DELAY_MS);
    } else {
      update({
        status: 'retry',
        transcript: '',
        message: '마이크를 누르고 빠진 단어만 말해도 돼요. 70%가 채워지면 넘어가요.',
      });
    }
  });

  const start = useCallback(
    async (text: string, key = text) => {
      if (busy.current || active.current) return;
      clearRestart();
      busy.current = true;
      const id = ++generation.current;
      if (attempt.current?.key !== key || attempt.current.text !== text) {
        attempt.current = { key, text, confirmed: matchLearningSpeechAttempt(text, '').matched };
      }
      update({ status: 'preparing', transcript: '', message: null });
      try {
        await abortLearningRecognition();
        if (id !== generation.current || !mounted.current) return;
        if (
          Platform.OS === 'android' &&
          (!speech.isRecognitionAvailable() || !speech.supportsOnDeviceRecognition())
        ) {
          update({
            status: 'unavailable',
            transcript: '',
            message:
              '이 기기는 기기 내 음성 인식을 지원하지 않아요. 듣기와 실전 녹음은 사용할 수 있어요.',
          });
          return;
        }
        const locales = await waitForLearningNative(speech.getSupportedLocales({}));
        if (id !== generation.current || !mounted.current) return;
        if (!locales.locales.some((locale) => locale.replace('_', '-').toLowerCase() === 'en-us')) {
          update({
            status: 'unavailable',
            transcript: '',
            message:
              '영어(미국) 음성 인식 언어를 사용할 수 없어요. 기기 설정에서 영어 음성 언어를 준비해 주세요.',
          });
          return;
        }
        const permission = await speech.requestMicrophonePermissionsAsync();
        if (id !== generation.current || !mounted.current) return;
        if (!permission.granted) {
          update({
            status: 'denied',
            transcript: '',
            message: '설정에서 마이크 접근을 허용한 뒤 다시 시도해 주세요.',
          });
          return;
        }
        await waitForLearningForeground();
        if (id !== generation.current || !mounted.current) return;
        active.current = {
          id,
          text,
          key,
          baseline: attempt.current?.confirmed ?? [],
          finalMatch: null,
          accepted: false,
          finishing: false,
          failed: false,
        };
        armWatchdog(id);
        speech.start({
          lang: 'en-US',
          requiresOnDeviceRecognition: true,
          interimResults: true,
          continuous: false,
          addsPunctuation: false,
          maxAlternatives: 3,
          contextualStrings: [
            ...new Set([
              text,
              ...text
                .split(/\s+/)
                .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
                .filter(Boolean),
            ]),
          ].slice(0, 100),
          iosTaskHint: 'dictation',
          recordingOptions: { persist: false },
          volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
          iosCategory: {
            category: 'playAndRecord',
            categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
            mode: 'measurement',
          },
        });
      } catch {
        if (id === generation.current) {
          active.current = null;
          clearWatchdog();
          speech.abort();
          update({
            status: 'unavailable',
            transcript: '',
            message:
              '기기 내 영어 인식을 시작하지 못했어요. 마이크와 영어 음성 언어 설정을 확인해 주세요.',
          });
        }
      } finally {
        if (id === generation.current) busy.current = false;
      }
    },
    [armWatchdog, clearWatchdog, clearRestart, update],
  );
  resume.current = start;
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (next) => {
      // Permission sheets may temporarily mark iOS inactive; only a real background cancels setup.
      if (next === 'background') void cancel().catch(() => undefined);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      void cancel().catch(() => undefined);
    };
  }, [cancel]);
  return { state, inputLevel, start, cancel, clearCompleted };
}
