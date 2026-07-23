import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import type { Ref } from "react";
import type { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";

/**
 * 탭바 버튼.
 *
 * react-navigation의 기본값인 `PlatformPressable`을 쓰지 않는다. 그쪽은 Android에서
 * 리플을 끌 수 없고(`android_ripple` 프롭은 내부 객체에 병합될 뿐, 켜짐 여부는
 * 플랫폼/버전으로만 결정된다) 리플이 켜지면 `pressOpacity`를 아예 무시한다.
 * 이 프로젝트는 두 플랫폼 모두 불투명도로 통일하므로(CLAUDE.md의 Touch feedback 항목,
 * `src/components/ui/Pressable.tsx`) 공용 Pressable을 쓴다.
 *
 * 다만 `BottomTabItem`은 `PlatformPressable`에 맞춘 프롭을 함께 넘긴다
 * (`android_ripple`, `pressOpacity`, `hoverEffect`). 이걸 그대로 흘려보내면
 * RN `Pressable`이 `android_ripple`을 그대로 해석해서 리플이 되살아나고, 나머지 둘은
 * 정체불명의 프롭으로 네이티브 뷰까지 내려간다. 그래서 여기서 걸러낸다.
 *
 * `role`은 덮어쓰지 않는다 — iOS는 'button', 그 외는 'tab'으로 react-navigation이
 * 이미 플랫폼별로 골라서 넘겨준다.
 *
 * React Navigation이 넘기는 `style`은 그대로 전달한다. 여기에는 탭 아이콘과 라벨의
 * 정렬·패딩이 들어 있으므로 일부만 재정의해도 기본 `PlatformPressable`과 위치가 달라진다.
 * 디버깅 과정은 `docs/react-navigation-tab-pressable-layout-fix.md`에 정리했다.
 */
export function TabBarButton({
  children,
  ref,
  style,
  // BottomTabItem이 주입하는 피드백 프롭이다. android_ripple은 의도적으로 제거하고,
  // 나머지 둘은 PlatformPressable 전용이므로 공용 Pressable로 넘기지 않는다.
  android_ripple: _androidRipple,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  ...props
}: BottomTabBarButtonProps) {
  return (
    // ref 캐스팅: react-navigation이 이 prop을 `Ref<View | LegacyRef<View>>`로 느슨하게
    // 선언해 둬서 RN의 `Ref<View>`와 바로 맞지 않는다. 실제로 넘어오는 값은 View ref다.
    <Pressable
      ref={ref as Ref<View>}
      accessible
      {...props}
      style={style}
    >
      {children}
    </Pressable>
  );
}
