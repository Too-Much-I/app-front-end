export const SENTRY_VALIDATION_ENVIRONMENT = "synthetic-validation";
export const SENTRY_VALIDATION_TAG_KEY = "synthetic_validation";
export const SENTRY_VALIDATION_TAG_VALUE = "true";

/** 개발 빌드와 명시적 flag가 모두 맞을 때만 일반 앱 대신 진단 root를 연다. */
export const IS_SENTRY_VALIDATION_MODE =
  __DEV__ && process.env.EXPO_PUBLIC_SENTRY_VALIDATION_MODE === "true";
