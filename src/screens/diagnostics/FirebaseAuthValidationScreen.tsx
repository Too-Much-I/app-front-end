import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FirebaseValidationStackParamList } from '@/navigation/types';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { createFirebaseAuthController } from '@/features/auth/firebase-auth-controller';
import { createFirebaseAuthSdk } from '@/features/auth/firebase-auth-sdk';
import type { FirebaseLoginProvider } from '@/features/auth/firebase-auth-types';

// 개발용 검증 화면에서만 생성한다. 서비스 세션과 Identity API를 건드리지 않는다.
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const kakaoProviderId = process.env.EXPO_PUBLIC_KAKAO_OIDC_PROVIDER_ID;
const appleEnabled = process.env.EXPO_PUBLIC_FIREBASE_APPLE_ENABLED === 'true';
const controller = createFirebaseAuthController(
  createFirebaseAuthSdk({
    google: googleWebClientId
      ? {
          webClientId: googleWebClientId,
          iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        }
      : undefined,
    apple: appleEnabled ? { enabled: true } : undefined,
    kakao: kakaoProviderId ? { providerId: kakaoProviderId } : undefined,
  }),
);

export function FirebaseAuthValidationScreen({
  navigation,
}: NativeStackScreenProps<FirebaseValidationStackParamList, 'Providers'>) {
  const operation = useStore(controller, (state) => state.operation);
  const [message, setMessage] = useState('로그인 수단을 선택해 Firebase 인증을 확인하세요.');
  const busy = operation.status === 'running' || operation.status === 'cancelling';
  useEffect(() => () => controller.cancel(), []);

  async function signIn(provider: FirebaseLoginProvider) {
    setMessage('인증을 시작합니다.');
    const result = await controller.signIn(provider);
    switch (result.kind) {
      case 'proof-ready':
        // 토큰·UID는 UI 상태·로그에 보관하지 않는다.
        setMessage(
          'Firebase 인증과 ID Token 획득에 성공했습니다. 서비스 로그인은 실행하지 않았습니다.',
        );
        return;
      case 'cancelled':
        setMessage('인증을 취소했습니다.');
        return;
      case 'failed':
        setMessage(`인증 실패: ${result.reason} / ${result.nextAction}`);
        return;
      case 'ignored':
        return;
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="p-screen gap-section">
        <Text className="text-xl">Firebase 인증 검증</Text>
        <Text>개발용 화면입니다. 기존 서비스 세션과 회원가입은 처리하지 않습니다.</Text>
        <View className="gap-element">
          <Button
            label="Google 인증"
            disabled={busy || !googleWebClientId}
            onPress={() => void signIn('google')}
          />
          <Button
            label="Apple 인증"
            disabled={busy || !appleEnabled}
            onPress={() => void signIn('apple')}
          />
          <Button
            label="카카오 인증"
            disabled={busy || !kakaoProviderId}
            onPress={() => void signIn('kakao')}
          />
          {operation.status === 'running' ? (
            <Button label="인증 취소" onPress={controller.cancel} />
          ) : null}
        </View>
        <Button
          label="전화번호 인증 검증"
          disabled={busy}
          onPress={() => navigation.navigate('Phone')}
        />
        <Text accessibilityRole="alert">
          {operation.status === 'cancelling' ? '이전 인증이 끝나기를 기다리고 있습니다.' : message}
        </Text>
        {!appleEnabled || !kakaoProviderId ? (
          <Text>설정이 없는 로그인 수단은 비활성화됩니다.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
