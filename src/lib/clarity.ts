import { Platform } from "react-native";

const CLARITY_PROJECT_ID = "xzxyrpjm2t";
const CLARITY_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_CLARITY === "true";

let initializationStarted = false;

/**
 * Clarity is loaded lazily so Expo Go can keep running when collection is
 * disabled. The package evaluates native modules as soon as it is imported.
 */
export function initializeClarity(): void {
  if (
    !CLARITY_ENABLED ||
    initializationStarted ||
    (Platform.OS !== "android" && Platform.OS !== "ios")
  ) {
    return;
  }

  initializationStarted = true;

  void import("@microsoft/react-native-clarity")
    .then((Clarity) => {
      Clarity.initialize(CLARITY_PROJECT_ID, {
        logLevel: Clarity.LogLevel.None,
      });
    })
    .catch((error: unknown) => {
      console.error("[Clarity] initialization failed", error);
    });
}
