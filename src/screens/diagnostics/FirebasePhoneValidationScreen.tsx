import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { createFirebasePhoneValidation } from '@/features/auth/firebase-phone-validation';
import type { FirebaseValidationStackParamList } from '@/navigation/types';
import { FONT_FAMILY } from '@/theme';

// 네비게이션 pop에도 입력과 재전송 제한을 유지한다. 개발 검증 모드에서만 로드된다.
const phoneValidation = createFirebasePhoneValidation();

export function FirebasePhoneValidationScreen({
  navigation,
}: NativeStackScreenProps<FirebaseValidationStackParamList, 'Phone'>) {
  const state = useStore(phoneValidation);
  const [now, setNow] = useState(Date.now);
  const connecting = state.connection.status !== 'idle';
  const pending =
    state.stage.status === 'sending' ||
    state.connection.status === 'running' ||
    state.stage.status === 'refreshing';
  const requestBlocked = connecting || state.stage.status === 'refreshing';
  // native-stack의 시스템 뒤로 가기와 iOS pop gesture도 동일하게 차단한다.
  usePreventRemove(pending, () => {});
  useEffect(() => phoneValidation.observeUser(), []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((state.nextSendAt - now) / 1000));
  return (
    <SafeAreaView className="flex-1 bg-surface p-screen gap-section">
      <Button label="뒤로" variant="text" disabled={pending} onPress={navigation.goBack} />
      <Text className="text-xl">Firebase 전화 인증 검증</Text>
      <Text>대한민국 +82 · 010 1234 5678</Text>
      <Text>Firebase 콘솔 테스트 번호로만 요청합니다. 테스트 코드: 123456</Text>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
        {state.connection.status === 'delayed'
          ? 'Firebase 연결 응답이 늦어지고 있어요. 뒤로 갈 수 있지만 기존 요청이 끝날 때까지 추가 요청은 실행하지 않습니다.'
          : state.connection.status === 'running'
            ? 'Firebase에서 전화번호 연결을 확인하고 있어요.'
            : state.message}
      </Text>
      {state.stage.status === 'code' || state.stage.status === 'verifying' ? (
        <View className="gap-element">
          <TextInput
            accessibilityLabel="테스트 인증번호 6자리"
            value={state.code}
            onChangeText={phoneValidation.setCode}
            editable={!requestBlocked}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            placeholder="6자리 코드"
            className="min-h-control-lg border border-line rounded-control px-card text-ink"
            style={{ fontFamily: FONT_FAMILY }}
          />
          <Button
            label={connecting ? '연결 응답 대기 중' : '인증 완료하기'}
            disabled={requestBlocked || state.code.length !== 6}
            onPress={() => void phoneValidation.verifyCode()}
          />
        </View>
      ) : null}
      {state.stage.status === 'linked' ? (
        <Button label="토큰 갱신 다시 시도" onPress={() => void phoneValidation.refreshProof()} />
      ) : null}
      {state.stage.status !== 'complete' &&
      state.stage.status !== 'linked' &&
      state.stage.status !== 'refreshing' ? (
        <Button
          label={
            state.attempts === 0
              ? '인증번호 받기'
              : remaining > 0
                ? `${remaining}초 후 다시 받기`
                : '인증번호 다시 받기'
          }
          disabled={requestBlocked || !state.uid || remaining > 0 || state.attempts >= 5}
          onPress={phoneValidation.requestCode}
        />
      ) : null}
      {state.attempts >= 2 ? (
        <Text>
          코드를 받지 못했다면 번호와 스팸 메시지함을 확인해주세요. 콘솔 테스트 번호에는 실제 SMS가
          오지 않습니다.
        </Text>
      ) : null}
      {state.attempts >= 5 ? (
        <Text>
          재전송 4회를 모두 사용했어요. 앱을 완전히 종료 후 다시 실행하면 앱의 제한이 초기화됩니다.
          Firebase 제한은 별도로 적용돼요.
        </Text>
      ) : null}
    </SafeAreaView>
  );
}
