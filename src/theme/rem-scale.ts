import { rem } from "nativewind";
import { useEffect } from "react";
import { Dimensions, useWindowDimensions } from "react-native";

/**
 * NativeWind의 rem 기본값.
 *
 * 빌드 타임 `inlineRem` 기본값(`nativewind/metro`)과 런타임 rem 옵저버블의
 * 기본값(`react-native-css-interop`)이 둘 다 14다. 같은 값이어서 scale이 1일 때
 * 스케일링 도입 전과 렌더 결과가 완전히 같다.
 */
export const BASE_REM = 14;

/** iPhone 15/16 표준 폭. 이 폭에서 scale이 정확히 1.0이 된다. */
const BASE_WIDTH = 393;

/**
 * 폭 비율을 그대로 반영하지 않고 절반만 반영한다.
 *
 * 11인치 iPad는 834pt로 기준 대비 2.12배다. 비율을 그대로 곱하면 글자가 화면을
 * 압도한다. 완충 계수와 상한을 함께 둬서 큰 화면에서 "조금 더 큰" 수준에 머물게 한다.
 */
const SLOPE = 0.5;

/**
 * 하한은 실기기에 닿는 값이 아니라 방어값이다. 가장 좁은 iPhone SE(375pt)도
 * 0.98이라 여유가 있고, 예외적인 폼팩터에서 무한정 작아지는 것만 막는다.
 */
const MIN_SCALE = 0.92;
const MAX_SCALE = 1.35;

/**
 * 화면 폭에 대응하는 스케일 계수.
 *
 * | 기기 | 폭(pt) | 원시 비율 | scale |
 * | --- | --- | --- | --- |
 * | iPhone SE | 375 | 0.95 | 0.98 |
 * | iPhone 15/16 | 393 | 1.00 | 1.00 |
 * | iPhone 16 Pro Max | 440 | 1.12 | 1.06 |
 * | iPad 11" 세로 | 834 | 2.12 | 1.35 (상한) |
 */
export function scaleForWidth(width: number): number {
  // NaN은 비교가 모두 false라 클램프를 그대로 통과해 MAX_SCALE이 된다.
  // Dimensions가 그런 값을 주는 경로는 확인되지 않았지만 명시적으로 막는다.
  if (!Number.isFinite(width) || width <= 0) return 1;

  const raw = 1 + (width / BASE_WIDTH - 1) * SLOPE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export function applyRemScale(width: number): void {
  rem.set(BASE_REM * scaleForWidth(width));
}

/**
 * 모듈 로드 시점에 한 번 맞춘다.
 *
 * React 렌더 이후 effect에서만 set하면 첫 프레임이 기본값 14로 그려진 뒤 바뀌어
 * 큰 화면에서 글자가 한 번 튄다. import 부작용이지만 의도된 것이다.
 */
applyRemScale(Dimensions.get("window").width);

/**
 * 실행 중 화면 폭 변화를 따라간다.
 *
 * 폴더블 접힘/펼침, iPad Split View 조정처럼 앱이 살아 있는 채로 폭이 바뀌는
 * 경우를 위한 것이다. 앱 루트에서 한 번만 호출한다.
 */
export function useRemScale(): void {
  const { width } = useWindowDimensions();

  useEffect(() => {
    applyRemScale(width);
  }, [width]);
}

/**
 * 현재 스케일 계수 자체가 필요한 곳(웹뷰 URL 조립)에서 쓴다.
 *
 * `rem.get()`을 읽지 않는 이유는 그것이 옵저버블이라 React가 변경을 구독하지
 * 못하기 때문이다. 폭에서 다시 계산하는 편이 단일 경로다.
 */
export function useScaleValue(): number {
  const { width } = useWindowDimensions();
  return scaleForWidth(width);
}
