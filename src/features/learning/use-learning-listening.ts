import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { LearningSentence } from '@/features/learning/learning-types';
import type { LearningProgress } from '@/features/learning/learning-progress';
import { useLearningAudio } from '@/features/learning/use-learning-audio';

type ListeningProgress = LearningProgress['listen'];
export function useLearningListening(
  sentences: LearningSentence[],
  active: boolean,
  onNext: () => void,
  initial: ListeningProgress = { index: 0, seconds: 0, heard: [] },
  onProgress?: (progress: ListeningProgress) => void,
) {
  const [index, setIndex] = useState(Math.min(initial.index, sentences.length - 1));
  const [running, setRunning] = useState(false);
  const cursor = useRef(index);
  const offset = useRef(initial.seconds);
  const heard = useRef(new Set(initial.heard));
  const epoch = useRef(0);
  const finished = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);
  const activeRef = useRef(active);
  const nextRef = useRef(onNext);
  const saveRef = useRef(onProgress);
  activeRef.current = active;
  nextRef.current = onNext;
  saveRef.current = onProgress;
  const {
    play,
    stop,
    pause: pauseAudio,
    resume: resumeAudio,
    getPosition,
    position,
    error,
  } = useLearningAudio();
  const save = useCallback((seconds: number) => {
    offset.current = seconds;
    saveRef.current?.({ index: cursor.current, seconds, heard: [...heard.current] });
  }, []);
  const pause = useCallback(() => {
    epoch.current++;
    save(getPosition() || offset.current);
    pauseAudio();
    setRunning(false);
  }, [getPosition, pauseAudio, save]);
  const complete = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    epoch.current++;
    stop();
    setRunning(false);
    save(0);
    nextRef.current();
  }, [save, stop]);
  const start = useCallback(
    async (from: number, seconds = 0, continuation?: Promise<boolean>) => {
      if (!activeRef.current || AppState.currentState !== 'active' || finished.current) return;
      const id = ++epoch.current;
      if (!continuation) stop();
      setRunning(true);
      for (let next = from; next < sentences.length; next++) {
        if (id !== epoch.current) return;
        cursor.current = next;
        setIndex(next);
        save(next === from ? seconds : 0);
        pending.current =
          next === from && continuation
            ? continuation
            : play(sentences[next].audio, next === from ? seconds : 0);
        const ok = await pending.current;
        if (id !== epoch.current) return;
        if (!ok) {
          setRunning(false);
          return;
        }
        heard.current.add(next);
        save(0);
      }
      complete();
    },
    [complete, play, save, sentences, stop],
  );
  const dispose = useCallback(() => {
    save(getPosition() || offset.current);
    epoch.current++;
    stop();
  }, [getPosition, save, stop]);
  useEffect(() => {
    void start(cursor.current, offset.current);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => {
      dispose();
      subscription.remove();
    };
  }, [dispose, pause, start]);
  useEffect(() => {
    if (!active) pause();
  }, [active, pause]);
  const move = (delta: number) => {
    if (!activeRef.current || finished.current) return;
    if (cursor.current + delta >= sentences.length) {
      complete();
      return;
    }
    void start(Math.max(0, cursor.current + delta));
  };
  const resume = () => {
    if (pending.current && resumeAudio())
      void start(cursor.current, offset.current, pending.current);
    else void start(cursor.current, offset.current);
  };
  // A delayed status from the previous clip must never light words in the new sentence.
  const seconds = position.source === sentences[index].audio ? position.seconds : -1;
  return { index, seconds, running, error, pause, resume, move };
}
