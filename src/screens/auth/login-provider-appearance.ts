import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';
import { colors } from '@/theme';

// Provider 고유 로고 색은 앱의 의미 색이 아니라 외부 브랜드 규격이다.
// 원형 로고(`LoginProviderMark`)와 로그인 화면의 긴 버튼(`LoginProviderButton`)이 같이 쓴다.
export const PROVIDER_APPEARANCE = {
  kakao: { background: '#FEE500', color: '#191919', icon: 'comment' },
  google: { background: colors.surface.DEFAULT, color: '#4285F4', icon: 'google' },
  apple: { background: '#000000', color: '#FFFFFF', icon: 'apple' },
} as const satisfies Record<FirebaseLoginProvider, object>;
