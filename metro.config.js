const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// annotateReactComponents는 빌드 타임에 컴포넌트 이름·소스 파일을 터치 breadcrumb의
// `data.path`에 실어준다. 재현 불가 제보에서 "어느 화면의 무엇을 눌렀는가"를 특정하기 위한 것.
//
// lib/sentry.ts의 scrubBreadcrumb이 이 경로를 통과시키도록 예외를 두고 있다
// (name/element/file만 남기고 label은 버림). 둘은 같이 움직여야 한다 — 한쪽만 끄면
// 컴포넌트 이름이 생성되지 않거나 생성돼도 전송 직전에 지워진다.
const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
});

module.exports = withNativeWind(config, {
  input: "./global.css",
  // rem을 빌드 타임 상수로 굽지 않고 런타임 옵저버블로 남긴다.
  // 이 값이 숫자면 CSS의 rem이 `value * inlineRem`으로 인라이닝되어
  // `rem.set()`이 무시된다(react-native-css-interop parseDeclaration).
  // 기본값 14와 런타임 rem 옵저버블의 기본값이 같으므로, 이 변경만으로는
  // 렌더 결과가 달라지지 않는다.
  inlineRem: false,
});
