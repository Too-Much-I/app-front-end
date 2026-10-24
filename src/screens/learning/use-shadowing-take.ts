import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PLAYBACK_AUDIO_MODE } from '@/features/audio/audio-session';
import { useTimedAudioRecorder } from '@/features/audio/use-timed-audio-recorder';
import { resolveLearningMediaUrl } from '@/features/learning/learning-media-url';
import { reportOperationalError } from '@/lib/operational-error-reporting';
import type { LearningSentence, LearningWord } from '@/types/learning';

export type ShadowingPhase =
  | 'idle'
  /** 음성 주소를 받거나 녹음을 준비하는 중. */
  | 'preparing'
  /** 녹음 없이 모범 음성만 듣는 중. */
  | 'listening'
  /** 모범 음성을 틀어 놓고 따라 말하며 녹음하는 중. */
  | 'shadowing'
  /** 모범 음성이 끝나고 녹음을 마무리하는 중. */
  | 'saving'
  | 'recorded'
  | 'playing-mine'
  | 'permission-denied'
  | 'failed';

/** 모범 음성이 끝난 뒤에도 사용자가 마지막 단어를 말할 시간. */
const TAIL_MS = 800;
/** 녹음 최대 길이 여유. 이 안에 `TAIL_MS` 뒤 마무리가 끝나지 않으면 녹음기가 스스로 멈춘다. */
const RECORDING_GRACE_MS = 3_000;
/** 음성이 없는 문장의 하이라이트 간격. 단어 길이(대개 0.1~0.4초)보다 충분히 짧다. */
const CLOCK_TICK_MS = 50;

/** 재생 위치(초)까지 시작한 단어 수. */
export function countStartedWords(words: readonly LearningWord[], positionSec: number): number {
  return words.filter((word) => word.start <= positionSec).length;
}

/**
 * 따라 말하기 한 문장(2026-10-23 결정 (가)).
 *
 * 모범 음성을 틀면 `words[].start/end`대로 단어가 칠해지고, "따라 말하기"면 동시에 녹음한다. STT는 쓰지 않는다.
 * 녹음 파일은 녹음 훅이 들고 있다가 다시 녹음하거나 이 훅이 사라질 때(다음 문장·화면 이탈) 지운다. 서버로 보내지
 * 않는다.
 *
 * 문장에 음성이 없으면 소리 없이 시계로만 하이라이트를 움직인다. 녹음은 그대로 한다.
 */
export function useShadowingTake(sentence: LearningSentence) {
  const modelPlayer = useAudioPlayer(null, { updateInterval: CLOCK_TICK_MS });
  const modelStatus = useAudioPlayerStatus(modelPlayer);
  const minePlayer = useAudioPlayer(null, { updateInterval: 100 });
  const mineStatus = useAudioPlayerStatus(minePlayer);
  const recorder = useTimedAudioRecorder<null>();
  const [phase, setPhase] = useState<ShadowingPhase>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [clockSec, setClockSec] = useState(0);
  const loadedUrlRef = useRef<string | null>(null);
  const clockStartedAtRef = useRef(0);
  /** 재생을 건 뒤 실제로 재생 중인 상태를 한 번 봐야 끝났다고 판단한다. 바꾼 직후 상태는 이전 음성 값일 수 있다. */
  const sawModelPlayingRef = useRef(false);
  const sawMinePlayingRef = useRef(false);
  /** 모범 음성이 끝난 뒤 `TAIL_MS` 마무리 타이머. 남은 타이머가 다음 녹음을 일찍 끝내지 않게 취소한다. */
  const tailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { audio, words } = sentence;
  const lastWordEnd = words[words.length - 1]?.end ?? 0;
  const modelActive = phase === 'listening' || phase === 'shadowing';
  const positionSec = !modelActive ? 0 : audio ? modelStatus.currentTime : clockSec;

  const restingPhase = recordingUri ? 'recorded' : 'idle';

  /** 모범 음성을 처음부터 틀 준비. 음성 주소는 재생 직전에 만료를 확인한다. */
  const prepareModel = useCallback(async () => {
    if (!audio) return;
    const url = await resolveLearningMediaUrl(audio);
    if (loadedUrlRef.current !== url) {
      modelPlayer.replace({ uri: url });
      loadedUrlRef.current = url;
    } else {
      await modelPlayer.seekTo(0);
    }
  }, [audio, modelPlayer]);

  const startModel = useCallback(() => {
    sawModelPlayingRef.current = false;
    if (audio) {
      modelPlayer.play();
      return;
    }
    clockStartedAtRef.current = Date.now();
    setClockSec(0);
  }, [audio, modelPlayer]);

  const clearTailTimer = useCallback(() => {
    if (tailTimerRef.current === null) return;
    clearTimeout(tailTimerRef.current);
    tailTimerRef.current = null;
  }, []);

  useEffect(() => clearTailTimer, [clearTailTimer]);

  const reportMediaFailure = useCallback((error: unknown) => {
    reportOperationalError({ code: 'LEARNING_LOAD_FAILED', resource: 'media', cause: error });
  }, []);

  const listen = useCallback(async () => {
    minePlayer.pause();
    setPhase('preparing');
    try {
      await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
      await prepareModel();
    } catch (error) {
      reportMediaFailure(error);
      setPhase('failed');
      return;
    }
    startModel();
    setPhase('listening');
  }, [minePlayer, prepareModel, reportMediaFailure, startModel]);

  const shadow = useCallback(async () => {
    clearTailTimer();
    minePlayer.pause();
    setPhase('preparing');
    try {
      // 녹음을 켜기 전에 주소부터 받아, 녹음 앞부분이 기다리는 시간으로 채워지지 않게 한다.
      await prepareModel();
    } catch (error) {
      reportMediaFailure(error);
      setPhase('failed');
      return;
    }
    const result = await recorder.start({
      context: null,
      maxDurationMs: Math.ceil(lastWordEnd * 1_000) + TAIL_MS + RECORDING_GRACE_MS,
    });
    if (!result.started) {
      setPhase(result.reason === 'permission-denied' ? 'permission-denied' : 'failed');
      return;
    }
    // 새 녹음을 시작하면 녹음 훅이 이전 파일을 지운다.
    setRecordingUri(null);
    startModel();
    setPhase('shadowing');
  }, [
    clearTailTimer,
    lastWordEnd,
    minePlayer,
    prepareModel,
    recorder,
    reportMediaFailure,
    startModel,
  ]);

  const finishRecording = useCallback(async () => {
    clearTailTimer();
    setPhase('saving');
    try {
      const recording = await recorder.finish('user');
      setRecordingUri(recording.audioFileUri);
      setPhase('recorded');
    } catch {
      // 앱이 뒤로 가는 등으로 녹음이 끊겼다. 다시 따라 말하면 된다.
      setPhase('failed');
    }
  }, [clearTailTimer, recorder]);

  /** 모범 음성이 끝났을 때. 따라 말하는 중이면 마지막 단어를 말할 틈을 두고 녹음을 마친다. */
  const onModelFinished = useCallback(() => {
    if (phase === 'listening') {
      setPhase(restingPhase);
      return;
    }
    if (phase !== 'shadowing') return;
    setPhase('saving');
    clearTailTimer();
    tailTimerRef.current = setTimeout(() => void finishRecording(), TAIL_MS);
  }, [clearTailTimer, finishRecording, phase, restingPhase]);

  const stop = useCallback(() => {
    if (audio) modelPlayer.pause();
    if (phase === 'shadowing') {
      void finishRecording();
      return;
    }
    if (phase === 'listening') setPhase(restingPhase);
    if (phase === 'playing-mine') {
      minePlayer.pause();
      setPhase('recorded');
    }
  }, [audio, finishRecording, minePlayer, modelPlayer, phase, restingPhase]);

  const playMine = useCallback(() => {
    if (!recordingUri) return;
    sawMinePlayingRef.current = false;
    minePlayer.replace({ uri: recordingUri });
    minePlayer.play();
    setPhase('playing-mine');
  }, [minePlayer, recordingUri]);

  // 음성이 있는 문장: 플레이어가 끝을 알려 준다.
  useEffect(() => {
    if (!audio || !modelActive) return;
    if (modelStatus.playing) {
      sawModelPlayingRef.current = true;
      return;
    }
    const reachedEnd =
      modelStatus.didJustFinish ||
      (modelStatus.duration > 0 && modelStatus.currentTime >= modelStatus.duration);
    if (sawModelPlayingRef.current && reachedEnd) onModelFinished();
  }, [audio, modelActive, modelStatus, onModelFinished]);

  // 음성이 없는 문장: 마지막 단어가 끝날 때까지 시계로 움직인다.
  useEffect(() => {
    if (audio || !modelActive) return undefined;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - clockStartedAtRef.current) / 1_000;
      if (elapsed > lastWordEnd) {
        clearInterval(timer);
        onModelFinished();
        return;
      }
      setClockSec(elapsed);
    }, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [audio, lastWordEnd, modelActive, onModelFinished]);

  // 내 녹음 다시 듣기가 끝나면 돌아온다.
  useEffect(() => {
    if (phase !== 'playing-mine') return;
    // expo-audio는 재생 오류를 예외가 아니라 상태의 `error`로 알린다. 놓치면 재생 중 상태에 멈춘다.
    if (mineStatus.error) {
      reportMediaFailure(new Error(mineStatus.error));
      setPhase('failed');
      return;
    }
    if (mineStatus.playing) {
      sawMinePlayingRef.current = true;
      return;
    }
    if (sawMinePlayingRef.current && mineStatus.didJustFinish) setPhase('recorded');
  }, [mineStatus, phase, reportMediaFailure]);

  return {
    phase,
    spokenCount: countStartedWords(words, positionSec),
    hasRecording: recordingUri !== null,
    canAskPermissionAgain: recorder.canAskPermissionAgain,
    listen,
    shadow,
    stop,
    playMine,
  };
}
