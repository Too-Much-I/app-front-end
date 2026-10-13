const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

function applySceneLifecycle(source) {
  if (source.includes('class AppSceneDelegate:')) return source;
  const windowDeclaration = '  var window: UIWindow?';
  const windowCreation = '    window = UIWindow(frame: UIScreen.main.bounds)';
  const reactStartup =
    /    factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)/;
  if (
    !source.includes(windowDeclaration) ||
    !source.includes(windowCreation) ||
    !reactStartup.test(source)
  ) {
    throw new Error('Expo AppDelegate layout changed; review the iOS scene lifecycle integration.');
  }
  // Remove only window creation and React startup. Firebase and other launch hooks stay in place.
  return (
    source
      .replace(
        windowDeclaration,
        `${windowDeclaration}\n  var sceneLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?`,
      )
      .replace(windowCreation, '    sceneLaunchOptions = launchOptions')
      .replace(reactStartup, '') +
    '\n' +
    fs.readFileSync(path.join(__dirname, 'app-scene-delegate.swift'), 'utf8')
  );
}

function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'App',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).AppSceneDelegate',
          },
        ],
      },
    };
    return result;
  });
  return withAppDelegate(config, (result) => {
    result.modResults.contents = applySceneLifecycle(result.modResults.contents);
    return result;
  });
}

module.exports = withIosSceneLifecycle;
module.exports.applySceneLifecycle = applySceneLifecycle;
