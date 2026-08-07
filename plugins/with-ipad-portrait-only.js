const { withInfoPlist } = require("expo/config-plugins");

/**
 * iPad를 iPhone과 동일하게 세로로 잠근다.
 *
 * `app.json`의 `orientation: "portrait"`은 iPhone에만 적용된다. Expo는
 * `supportsTablet: true`일 때 iPad용 키에 네 방향을 모두 넣기 때문에,
 * 태블릿을 지원하면서 세로만 허용하려면 이 키를 직접 덮어써야 한다.
 *
 * `ios/`가 .gitignore 대상이라 Info.plist를 손으로 고치면 그 수정은 이 머신의
 * 생성물에만 남는다. 새로 클론한 작업 공간에는 `ios/` 자체가 없어 prebuild로
 * 다시 만들어야 하고, 그 결과물에는 손수정이 없다. plugin으로 선언해야
 * 어느 환경에서 prebuild하든 방향 잠금이 동일하게 재현된다.
 *
 * 알려진 비용: iPadOS가 전 방향을 지원하지 않는 앱을 Split View / Slide Over
 * 대상에서 제외할 수 있다. "태블릿은 지원하되 세로 전용" 방침에서 감수하는 부분이다.
 */
const PORTRAIT_ONLY = [
  "UIInterfaceOrientationPortrait",
  "UIInterfaceOrientationPortraitUpsideDown",
];

module.exports = function withIpadPortraitOnly(config) {
  return withInfoPlist(config, (config) => {
    config.modResults["UISupportedInterfaceOrientations~ipad"] = PORTRAIT_ONLY;
    return config;
  });
};
