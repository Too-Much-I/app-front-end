import { Accelerometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { AppState, useWindowDimensions } from "react-native";

/** 4Hz. 안내 문구 하나를 띄우는 데 이보다 잦은 표본은 배터리 낭비다. */
const UPDATE_INTERVAL_MS = 250;

/** 가로로 눕히면 중력이 x축으로 넘어간다. */
const LANDSCAPE_X = 0.7;

/**
 * 책상에 평평히 놓은 상태를 가로로 오판하지 않기 위한 배제 조건.
 *
 * 이때 중력이 z축에 몰리고 x·y는 노이즈 수준으로 흔들려 순간적으로 임계를 넘을 수 있다.
 */
const FLAT_Z = 0.85;

/** 이 시간 이상 유지돼야 상태를 바꾼다. 임계 근처 진동으로 깜빡이는 것을 막는다. */
const SUSTAIN_MS = 800;

/**
 * 기기가 가로로 눕혀졌는지 알려준다.
 *
 * 두 신호의 OR다.
 *
 * 1. 가속도계 — 주 경로다. 앱이 모든 플랫폼에서 세로로 잠겨 있어 `Dimensions`가
 *    회전에 반응하지 않으므로, 이것 없이는 감지 자체가 불가능하다.
 * 2. 창 비율 — 안전망이다. 방향 잠금 아래에서는 거의 항상 false지만, iPadOS
 *    멀티태스킹처럼 기기 방향과 무관하게 창이 가로로 넓어지는 경로를 덮는다.
 *
 * x의 부호가 아니라 절댓값을 쓰는 이유: expo-sensors의 축 부호는 iOS와 Android가
 * 다르다. 크기만 보면 두 플랫폼에서 같은 코드가 동작한다. 좌우 어느 쪽으로
 * 눕혔는지는 이 기능에 필요 없다.
 */
export function useLandscapeDetection(): boolean {
  const { width, height } = useWindowDimensions();
  const [sensorLandscape, setSensorLandscape] = useState(false);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let candidate = false;
    let cancelled = false;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleReading = ({ x, z }: { x: number; z: number }) => {
      const next = Math.abs(x) > LANDSCAPE_X && Math.abs(z) < FLAT_Z;
      if (next === candidate) return;

      candidate = next;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        setSensorLandscape(next);
      }, SUSTAIN_MS);
    };

    const start = async () => {
      // AppState가 active로 여러 번 전이해도 구독이 중복되지 않게 한다.
      if (subscription !== null) return;

      const available = await Accelerometer.isAvailableAsync();
      // iOS 시뮬레이터에는 가속도계가 없다. 여기서 조용히 빠져나가면
      // 창 비율 신호만 남고 훅은 정상 동작한다.
      if (cancelled || !available || subscription !== null) return;

      Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
      subscription = Accelerometer.addListener(handleReading);
    };

    const stop = () => {
      subscription?.remove();
      subscription = null;
      clearTimer();
      candidate = false;
      setSensorLandscape(false);
    };

    if (AppState.currentState === "active") void start();

    // 백그라운드에서 센서를 돌릴 이유가 없다. 배터리 비용의 대부분이 여기서 준다.
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void start();
      else stop();
    });

    return () => {
      cancelled = true;
      appStateSubscription.remove();
      stop();
    };
  }, []);

  return sensorLandscape || width > height;
}
