// The standalone sample needs no Firebase credentials, login, billing or analytics SDKs.
// Normal app autolinking is unchanged when the explicit sample command is not used.
module.exports =
  process.env.LEARNING_SAMPLE === '1'
    ? {
        dependencies: Object.fromEntries(
          [
            '@react-native-firebase/app',
            '@react-native-firebase/auth',
            '@react-native-firebase/analytics',
            '@react-native-firebase/messaging',
            '@react-native-google-signin/google-signin',
            '@microsoft/react-native-clarity',
            'expo-iap',
          ].map((name) => [name, { platforms: { ios: null, android: null } }]),
        ),
      }
    : {};
