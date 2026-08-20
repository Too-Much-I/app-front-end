const { withInfoPlist } = require("expo/config-plugins");

/**
 * Part 4의 명시적 가로 표 보기에 필요한 iOS capability를 선언한다.
 *
 * `app.json.orientation`과 expo-screen-orientation의 initialOrientation은 앱의
 * 기본 상태를 세로로 유지한다. 이 plugin은 runtime `LANDSCAPE` 요청이 iPhone과
 * iPad 모두에서 지원되는 방향으로 인정되도록 Info.plist의 capability만 넓힌다.
 *
 * 앱은 `ios.supportsTablet: false`로 iPhone 전용이며 iPad에서는 호환 모드로만
 * 실행된다. `~ipad` 키는 그 호환 모드에서도 같은 방향 집합을 쓰도록 남겨둔다.
 */
const RUNTIME_ORIENTATIONS = [
  "UIInterfaceOrientationPortrait",
  "UIInterfaceOrientationLandscapeLeft",
  "UIInterfaceOrientationLandscapeRight",
];

module.exports = function withIosRuntimeOrientationSupport(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UISupportedInterfaceOrientations = RUNTIME_ORIENTATIONS;
    config.modResults["UISupportedInterfaceOrientations~ipad"] = RUNTIME_ORIENTATIONS;
    return config;
  });
};
