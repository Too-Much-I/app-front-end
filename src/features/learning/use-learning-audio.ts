import type { LearningMedia } from '@/features/learning/learning-types';
import { resolveLearningMedia } from '@/features/learning/api/resolve-learning-media';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYBACK_AUDIO_MODE } from '@/features/audio/audio-session';

export function useLearningAudio() {
  const owner = useRef<{
    player: AudioPlayer;
    finish: (ok: boolean) => void;
    paused: boolean;
  } | null>(null);
  const sequence = useRef(0);
  const mediaRequest = useRef<AbortController | null>(null);
  const failedMedia = useRef<string | null>(null);
  const pauseRequested = useRef(false);
  const mounted = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState<{
    source: number | string | LearningMedia | null;
    seconds: number;
    duration: number;
  }>({ source: null, seconds: 0, duration: 0 });
  const [error, setError] = useState<string | null>(null);
  const stop = useCallback(() => {
    sequence.current++;
    mediaRequest.current?.abort();
    mediaRequest.current = null;
    pauseRequested.current = false;
    owner.current?.finish(false);
  }, []);
  const getPosition = useCallback(() => owner.current?.player.currentTime ?? 0, []);
  const pause = useCallback(() => {
    pauseRequested.current = true;
    setPlaying(false);
    setPaused(true);
    const current = owner.current;
    if (!current) return;
    current.paused = true;
    current.player.pause();
    setPlaying(false);
    setPaused(true);
  }, []);
  const resume = useCallback(() => {
    const current = owner.current;
    if (!current) return false;
    pauseRequested.current = false;
    current.paused = false;
    current.player.play();
    setPlaying(true);
    setPaused(false);
    return true;
  }, []);
  const play = useCallback(
    async (source: number | string | LearningMedia, fromSeconds = 0): Promise<boolean> => {
      stop();
      const id = sequence.current;
      if (mounted.current) {
        setError(null);
        setPaused(false);
        setPosition({ source: null, seconds: fromSeconds, duration: 0 });
      }
      try {
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (!mounted.current || id !== sequence.current) return false;
        const controller = new AbortController();
        mediaRequest.current = controller;
        const resolved =
          typeof source === 'object'
            ? await resolveLearningMedia(
                source,
                controller.signal,
                failedMedia.current === source.id,
              )
            : source;
        if (!mounted.current || id !== sequence.current) return false;
        const player = createAudioPlayer(resolved, { updateInterval: 50 });
        if (mounted.current) setPlaying(!pauseRequested.current);
        return await new Promise<boolean>((resolve) => {
          let finished = false;
          let started = false;
          const finish = (ok: boolean) => {
            if (finished) return;
            finished = true;
            if (ok) failedMedia.current = null;
            clearTimeout(timeout);
            listener.remove();
            player.pause();
            player.remove();
            if (owner.current?.player === player) owner.current = null;
            if (mounted.current) {
              setPlaying(false);
              setPaused(false);
            }
            resolve(ok);
          };
          const begin = async () => {
            if (started || finished) return;
            started = true;
            clearTimeout(timeout);
            try {
              if (fromSeconds > 0)
                await player.seekTo(Math.min(fromSeconds, Math.max(0, player.duration - 0.05)));
              if (!finished && !owner.current?.paused) player.play();
            } catch {
              finish(false);
            }
          };
          const listener = player.addListener('playbackStatusUpdate', (status) => {
            if (mounted.current && !finished && status.isLoaded)
              setPosition({ source, seconds: status.currentTime, duration: status.duration });
            if (status.didJustFinish) finish(true);
            else if (status.error) {
              if (typeof source === 'object') failedMedia.current = source.id;
              if (mounted.current) setError('음성을 재생하지 못했어요. 다시 눌러 주세요.');
              finish(false);
            } else if (status.isLoaded) void begin();
          });
          const timeout = setTimeout(() => {
            if (typeof source === 'object') failedMedia.current = source.id;
            if (mounted.current) setError('음성을 불러오지 못했어요. 다시 눌러 주세요.');
            finish(false);
          }, 15000);
          owner.current = { player, finish, paused: pauseRequested.current };
          if (player.isLoaded) void begin();
        });
      } catch {
        if (mounted.current && id === sequence.current) {
          setError('음성을 재생하지 못했어요. 다시 눌러 주세요.');
          setPlaying(false);
        }
        return false;
      }
    },
    [stop],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, [stop]);
  return { play, stop, pause, resume, getPosition, playing, paused, position, error };
}
