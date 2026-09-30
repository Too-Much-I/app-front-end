import { IS_SENTRY_VALIDATION_MODE } from '@/lib/sentry-validation-mode';

/** UI 확인 전용 진입점. 릴리스 빌드에서는 켤 수 없고 실제 세션과 분리한다. */
export const IS_AUTH_UI_PREVIEW =
  __DEV__ && !IS_SENTRY_VALIDATION_MODE && process.env.EXPO_PUBLIC_AUTH_UI_PREVIEW === 'true';
