const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // rem을 빌드 타임 상수로 굽지 않고 런타임 옵저버블로 남긴다.
  // 이 값이 숫자면 CSS의 rem이 `value * inlineRem`으로 인라이닝되어
  // `rem.set()`이 무시된다(react-native-css-interop parseDeclaration).
  // 기본값 14와 런타임 rem 옵저버블의 기본값이 같으므로, 이 변경만으로는
  // 렌더 결과가 달라지지 않는다.
  inlineRem: false,
});
