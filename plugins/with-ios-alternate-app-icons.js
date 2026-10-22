const {
  withAlternateAppIconsGenerator,
} = require("expo-alternate-app-icons/plugin/build/ios/withAlternateAppIconsGenerator");
const {
  withXcodeProjectUpdate,
} = require("expo-alternate-app-icons/plugin/build/ios/withXcodeProjectUpdate");

/**
 * iOS 바이너리에 대체 아이콘을 넣는다. App Store 제품 페이지 최적화(A/B 테스트)는
 * 바이너리에 들어 있는 대체 아이콘만 처리로 고를 수 있다.
 *
 * expo-alternate-app-icons의 기본 plugin은 Android manifest에 activity-alias도 추가한다.
 * Android 아이콘 실험은 Play Console 스토어 등록정보 실험으로 하므로 Android는 건드리지 않고,
 * 라이브러리 내부의 iOS mod 두 개(아이콘 묶음 생성, ALTERNATE_APPICON_NAMES 등록)만 쓴다.
 * 내부 경로에 의존하므로 라이브러리를 올릴 때 이 두 파일의 위치와 시그니처를 확인한다.
 */
const ALTERNATE_ICONS = [{ name: "Halloween", ios: "./assets/icon-halloween.png" }];

module.exports = function withIosAlternateAppIcons(config) {
  config = withAlternateAppIconsGenerator(config, ALTERNATE_ICONS);
  return withXcodeProjectUpdate(
    config,
    ALTERNATE_ICONS.map((icon) => icon.name),
  );
};
