import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';

const LOGIN_PROVIDER_LABELS = {
  kakao: '카카오',
  google: 'Google',
  apple: 'Apple',
} as const satisfies Record<FirebaseLoginProvider, string>;

export function getLoginProviderLabel(provider: FirebaseLoginProvider): string {
  return LOGIN_PROVIDER_LABELS[provider];
}
