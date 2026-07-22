import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/**
 * 기본 폰트가 Jua인 Text.
 *
 * RN의 `Text`는 tailwind 설정을 모르기 때문에, 아무것도 지정하지 않으면
 * iOS는 San Francisco / Android는 Roboto로 갈린다. 화면마다 `font-jua`를 붙이는 대신
 * 이 컴포넌트를 쓰고, RN `Text`는 직접 쓰지 않는다.
 *
 * `className`으로 넘긴 폰트/크기 유틸리티가 뒤에 와서 그대로 덮어쓴다.
 */
export function Text({ className, ...props }: RNTextProps & { className?: string }) {
  return <RNText className={`font-jua text-ink ${className ?? ""}`} {...props} />;
}
