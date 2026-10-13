const { withEntitlementsPlist } = require('expo/config-plugins');

// Switching an existing native folder to the sample can retain production
// entitlements. The learning-only app must also build with a personal team.
module.exports = function withSampleEntitlements(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    delete mod.modResults['com.apple.developer.applesignin'];
    return mod;
  });
};
