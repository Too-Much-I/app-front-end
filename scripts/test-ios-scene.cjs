const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applySceneLifecycle } = require('../plugins/with-ios-scene-lifecycle');

const template = `class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  func start() {
    window = UIWindow(frame: UIScreen.main.bounds)
FirebaseApp.configure()
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}`;

test('scene startup preserves Firebase initialization and Expo launch subscribers', () => {
  const result = applySceneLifecycle(template);
  assert.equal(result.split('FirebaseApp.configure()').length - 1, 1);
  assert.match(
    result,
    /return super.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
  );
  assert.match(result, /UIWindow\(windowScene: windowScene\)/);
  assert.doesNotMatch(result, /UIWindow\(frame: UIScreen.main.bounds\)/);
  assert.equal(result.split('startReactNative(').length - 1, 1);
  assert.match(result, /options\[.sourceApplication\] = source/);
  assert.match(result, /connectionOptions.urlContexts/);
  assert.match(result, /connectionOptions.userActivities/);
});

test('repeated prebuild is idempotent', () => {
  const result = applySceneLifecycle(template);
  assert.equal(applySceneLifecycle(result), result);
});

test('an unexpected Expo template fails instead of dropping initialization', () => {
  assert.throws(() => applySceneLifecycle('class AppDelegate {}'), /layout changed/);
});
