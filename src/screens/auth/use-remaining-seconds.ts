import { useEffect, useState } from 'react';

const TICK_MS = 1_000;

/** until까지 남은 초. 지났거나 없으면 null이다. 화면에 있는 동안만 센다. */
export function useRemainingSeconds(until: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until === null) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) clearInterval(timer);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [until]);

  if (until === null || until <= now) return null;
  return Math.ceil((until - now) / 1000);
}

/** 버튼 라벨 뒤에 남은 시간을 붙인다. 예: `인증번호 받기 (0:42)` */
export function withRemainingTime(label: string, seconds: number | null): string {
  if (seconds === null) return label;
  const minutes = Math.floor(seconds / 60);
  return `${label} (${minutes}:${String(seconds % 60).padStart(2, '0')})`;
}
