const { withPodfile } = require('expo/config-plugins');

// Expo 57 autolinking can retain RNFBApp despite a null platform override.
// Keep that unused native dependency on CocoaPods without configuring Firebase.
module.exports = function withSamplePods(config) {
  return withPodfile(config, (mod) => {
    const flag = '$RNFirebaseDisableSPM = true';
    if (!mod.modResults.contents.includes(flag)) {
      mod.modResults.contents = `${flag}\n${mod.modResults.contents}`;
    }
    return mod;
  });
};
