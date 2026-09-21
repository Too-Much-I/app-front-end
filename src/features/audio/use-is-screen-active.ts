import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * 화면이 focus되어 있고 앱이 foreground인 구간.
 *
 * 오디오 세션 소유권(`useRecordingAudioSession`)의 입력이다. 사용자가 실제로 보고 있는
 * 화면만 세션을 잡게 해서, 화면을 떠난 뒤에도 세션을 붙들고 있는 상태를 만들지 않는다.
 *
 * `use-microphone-test`는 같은 사실을 자체 ref로도 들고 있다. 중복으로 보이지만 대체할 수
 * 없다 — 그쪽은 `await`가 끝난 뒤의 최신값을 읽어야 하는 가드라 리렌더에 실려 오는 값으로는
 * 안 된다. 이 훅의 state는 세션 소유권 전용이며 그 ref를 읽거나 쓰지 않는다.
 */
export function useIsScreenActive(): boolean {
  const isFocused = useIsFocused();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  return isFocused && isAppActive;
}
