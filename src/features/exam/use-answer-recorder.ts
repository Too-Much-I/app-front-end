"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ANSWER_LEVEL_BAR_COUNT = 24;

/**
 * 문항별 답변 녹음을 캡처하는 훅.
 * 녹음본은 업로드 전까지 메모리(Blob)에만 잠깐 들고 있는다 — 별도의 로컬 임시 저장소는 두지 않는다.
 *
 * 녹음 중에는 AnalyserNode로 실제 마이크 음량을 읽어 levelBarRefs에 등록된 DOM
 * 엘리먼트의 높이를 직접 갱신한다(리렌더 없이) — mic-test-panel의 파형 표시와 동일한 방식.
 */
export function useAnswerRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelBarRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // getUserMedia는 비동기라 완료 전에 stopRecording이 먼저 호출될 수 있다 —
  // stopRecording이 이 promise를 기다려서 recorderRef가 세팅되기 전에 빈 Blob으로
  // 끝나버리는 레이스를 막는다.
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
    levelBarRefs.current.forEach((el) => {
      if (el) el.style.height = "4px";
    });
  }, []);

  const startVisualizer = useCallback((stream: MediaStream) => {
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

    const step = Math.max(1, Math.floor(analyser.frequencyBinCount / ANSWER_LEVEL_BAR_COUNT));

    const tick = () => {
      const analyserNode = analyserRef.current;
      const data = dataRef.current;
      if (!analyserNode || !data) return;

      analyserNode.getByteFrequencyData(data);

      for (let i = 0; i < ANSWER_LEVEL_BAR_COUNT; i++) {
        const v = (data[i * step] ?? 0) / 255;
        const el = levelBarRefs.current[i];
        if (el) el.style.height = `${Math.max(4, v * 32)}px`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const startRecording = useCallback(() => {
    const promise = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      startVisualizer(stream);
    })();
    startPromiseRef.current = promise;
    return promise;
  }, [startVisualizer]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    // startRecording()이 아직 getUserMedia를 기다리는 중일 수 있으니, recorderRef를
    // 확인하기 전에 먼저 끝나도록 기다린다. 실패했다면(마이크 접근 거부 등) 여기서
    // 무시하고 아래 recorderRef 체크로 자연스럽게 빈 Blob을 반환한다.
    const startPromise = startPromiseRef.current;
    await startPromise?.catch(() => {});
    // await 하는 동안 새 startRecording()이 startPromiseRef를 교체했을 수 있으니,
    // 우리가 기다린 promise가 여전히 최신일 때만 비운다.
    if (startPromiseRef.current === startPromise) {
      startPromiseRef.current = null;
    }

    return new Promise((resolve) => {
      stopVisualizer();
      const recorder = recorderRef.current;
      if (!recorder) {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
        resolve(audioBlob);
      };
      recorder.stop();
    });
  }, [stopVisualizer]);

  // 녹음 중에 탭 전환/페이지 이동 등으로 컴포넌트가 언마운트되면 마이크 스트림이 계속
  // 켜진 채로 남을 수 있어, 언마운트 시 강제로 정리한다.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      stopVisualizer();
    };
  }, [stopVisualizer]);

  return { isRecording, startRecording, stopRecording, levelBarRefs };
}
