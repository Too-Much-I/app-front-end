import * as ScreenOrientation from "expo-screen-orientation";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import {
  OrientationContext,
  type OrientationMode,
} from "@/features/orientation/orientation-context";

const PORTRAIT_LOCK = ScreenOrientation.OrientationLock.PORTRAIT_UP;
const LANDSCAPE_LOCK = ScreenOrientation.OrientationLock.LANDSCAPE;

type DesiredLock = typeof PORTRAIT_LOCK | typeof LANDSCAPE_LOCK;

/**
 * 앱의 기본 세로 정책과 Part 4의 명시적 가로 예외를 직렬화한다.
 *
 * native lock은 비동기라 enter 도중 close나 screen cleanup이 겹칠 수 있다. 모든
 * 요청을 하나의 chain에 넣고 desired lock을 별도 ref로 보관해, 늦게 끝난 가로
 * 요청이 더 최신인 세로 복귀를 덮지 못하게 한다.
 */
export function OrientationProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<OrientationMode>("portrait");
  const modeRef = useRef<OrientationMode>("portrait");
  const desiredLockRef = useRef<DesiredLock>(PORTRAIT_LOCK);
  const transitionChainRef = useRef<Promise<void>>(Promise.resolve());
  const restorePromiseRef = useRef<Promise<void> | null>(null);

  const setMode = useCallback((nextMode: OrientationMode) => {
    modeRef.current = nextMode;
    setModeState(nextMode);
  }, []);

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = transitionChainRef.current.then(operation, operation);
    transitionChainRef.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, []);

  const recoverPortraitAfterLandscapeFailure = useCallback(
    async (reason: "unsupported" | "request-failed") => {
      // restore가 이미 예약됐다면 그 작업이 chain의 마지막에서 복구를 담당한다.
      if (desiredLockRef.current !== LANDSCAPE_LOCK) return;

      desiredLockRef.current = PORTRAIT_LOCK;
      if (reason === "unsupported") {
        console.warn("[Orientation] 이 기기는 Part 4 가로 보기를 지원하지 않아요");
      }

      try {
        await ScreenOrientation.lockAsync(PORTRAIT_LOCK);
      } catch (error) {
        console.error("[Orientation] 가로 보기 실패 후 세로 복구를 적용하지 못했어요", error);
      } finally {
        setMode("portrait");
      }
    },
    [setMode],
  );

  const requestTableLandscape = useCallback((): Promise<boolean> => {
    // state commit을 기다리지 않고 ref를 먼저 바꿔 같은 frame의 연속 입력도 차단한다.
    if (modeRef.current !== "portrait") return Promise.resolve(false);

    desiredLockRef.current = LANDSCAPE_LOCK;
    setMode("entering-landscape");

    return enqueue(async () => {
      // 실행 차례가 오기 전에 close/cleanup이 들어왔다면 가로 요청을 생략한다.
      if (desiredLockRef.current !== LANDSCAPE_LOCK) return false;

      try {
        const supported =
          await ScreenOrientation.supportsOrientationLockAsync(LANDSCAPE_LOCK);
        if (!supported) {
          await recoverPortraitAfterLandscapeFailure("unsupported");
          return false;
        }

        await ScreenOrientation.lockAsync(LANDSCAPE_LOCK);
        if (desiredLockRef.current !== LANDSCAPE_LOCK) return false;

        setMode("landscape");
        return true;
      } catch (error) {
        console.error("[Orientation] Part 4 가로 보기를 적용하지 못했어요", error);
        await recoverPortraitAfterLandscapeFailure("request-failed");
        return false;
      }
    });
  }, [enqueue, recoverPortraitAfterLandscapeFailure, setMode]);

  const restorePortrait = useCallback((): Promise<void> => {
    if (
      desiredLockRef.current === PORTRAIT_LOCK &&
      (modeRef.current === "portrait" || restorePromiseRef.current)
    ) {
      return restorePromiseRef.current ?? Promise.resolve();
    }

    desiredLockRef.current = PORTRAIT_LOCK;
    setMode("restoring-portrait");

    const restorePromise = enqueue(async () => {
      try {
        await ScreenOrientation.lockAsync(PORTRAIT_LOCK);
      } catch (error) {
        // UI policy는 복구해 센서 안내가 manual recovery path로 다시 동작하게 한다.
        console.error("[Orientation] 세로 화면 잠금을 복원하지 못했어요", error);
      } finally {
        if (desiredLockRef.current === PORTRAIT_LOCK) setMode("portrait");
      }
    });

    restorePromiseRef.current = restorePromise;
    void restorePromise.finally(() => {
      if (restorePromiseRef.current === restorePromise) restorePromiseRef.current = null;
    });
    return restorePromise;
  }, [enqueue, setMode]);

  useEffect(() => {
    const reinforceDesiredLock = () => {
      // 진행 중인 enter/restore 자체가 최신 desired lock을 적용한다.
      if (
        modeRef.current === "entering-landscape" ||
        modeRef.current === "restoring-portrait"
      ) {
        return;
      }

      const desiredLock = desiredLockRef.current;
      void enqueue(async () => {
        // event 뒤에 더 최신 enter/restore가 생겼다면 그 요청이 native lock을 담당한다.
        if (desiredLockRef.current !== desiredLock) return;

        try {
          if (desiredLock === LANDSCAPE_LOCK) {
            const supported =
              await ScreenOrientation.supportsOrientationLockAsync(LANDSCAPE_LOCK);
            if (!supported) {
              await recoverPortraitAfterLandscapeFailure("unsupported");
              return;
            }
            if (desiredLockRef.current !== desiredLock) return;
          }

          await ScreenOrientation.lockAsync(desiredLock);
          if (desiredLockRef.current !== desiredLock) return;
          setMode(desiredLock === LANDSCAPE_LOCK ? "landscape" : "portrait");
        } catch (error) {
          console.error("[Orientation] 현재 화면 방향을 다시 적용하지 못했어요", error);
          if (desiredLock === LANDSCAPE_LOCK) {
            await recoverPortraitAfterLandscapeFailure("request-failed");
          } else if (desiredLockRef.current === PORTRAIT_LOCK) {
            setMode("portrait");
          }
        }
      });
    };

    reinforceDesiredLock();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reinforceDesiredLock();
    });
    return () => subscription.remove();
  }, [enqueue, recoverPortraitAfterLandscapeFailure, setMode]);

  const value = useMemo(
    () => ({
      mode,
      isLandscapeTableRequested: mode !== "portrait",
      requestTableLandscape,
      restorePortrait,
    }),
    [mode, requestTableLandscape, restorePortrait],
  );

  return <OrientationContext.Provider value={value}>{children}</OrientationContext.Provider>;
}
