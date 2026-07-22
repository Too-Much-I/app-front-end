import { Jua_400Regular } from "@expo-google-fonts/jua";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useCallback } from "react";

void SplashScreen.preventAutoHideAsync();

/**
 * 앱 폰트 로딩.
 *
 * 폰트가 준비되기 전에 화면을 그리면 시스템 폰트로 한 프레임 렌더된 뒤 Jua로 교체되면서
 * 레이아웃이 한 번 튄다(FOUT). 스플래시를 붙잡고 있다가 로드가 끝난 뒤 내려서 이를 막는다.
 *
 * 반환한 `onLayoutRootView`를 루트 View의 `onLayout`에 연결해야 하는데,
 * 실제로 첫 프레임이 그려진 다음 스플래시를 내려야 빈 화면이 보이지 않기 때문이다.
 */
export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({ Jua_400Regular });

  const ready = fontsLoaded || fontError !== null;

  const onLayoutRootView = useCallback(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  return { ready, onLayoutRootView };
}
