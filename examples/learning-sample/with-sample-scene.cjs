const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// iOS 27 requires UIScene; preserve Expo's linking and lifecycle forwarding.
module.exports = function withSampleScene(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Learning',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).LearningSceneDelegate',
          },
        ],
      },
    };
    return result;
  });
  config = withAppDelegate(config, (result) => {
    if (result.modResults.contents.includes('class LearningSceneDelegate')) return result;
    const start = '    window = UIWindow(frame: UIScreen.main.bounds)';
    const end = '      launchOptions: launchOptions)';
    const source = result.modResults.contents;
    const first = source.indexOf(start),
      last = source.indexOf(end, first);
    if (first < 0 || last < 0) throw new Error('Learning scene AppDelegate layout changed');
    result.modResults.contents = (
      source.slice(0, first) +
      '    learningLaunchOptions = launchOptions' +
      source.slice(last + end.length)
    ).replace(
      '  var window: UIWindow?',
      '  var window: UIWindow?\n  var learningLaunchOptions: [UIApplication.LaunchOptionsKey: Any]?',
    );
    result.modResults.contents +=
      '\n' + fs.readFileSync(path.join(__dirname, 'learning-scene.swift'), 'utf8');
    return result;
  });
  return config;
};
