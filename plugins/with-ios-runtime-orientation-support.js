const { withInfoPlist } = require("expo/config-plugins");

/**
 * Part 4의 명시적 가로 표 보기에 필요한 iOS capability를 선언한다.
 *
 * `app.json.orientation`과 expo-screen-orientation의 initialOrientation은 앱의
 * 기본 상태를 세로로 유지한다. 이 plugin은 runtime `LANDSCAPE` 요청이 iPhone과
 * iPad 모두에서 지원되는 방향으로 인정되도록 Info.plist의 capability만 넓힌다.
 *
 * iPad에서는 runtime 방향 잠금을 보장하기 위해 `ios.requireFullScreen`도 함께
 * 사용한다. 그 결과 Split View와 Slide Over는 지원하지 않는다.
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
