import { Feather } from '@expo/vector-icons';
import { Image, TextInput, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthScreenFrame } from '@/screens/auth/components/AuthScreenFrame';
import { withRemainingTime } from '@/screens/auth/use-remaining-seconds';
import { colors, duration, FONT_FAMILY, size } from '@/theme';

export type PhoneVerificationViewState =
  | { step: 'number'; phone: string; error: string | null }
  | { step: 'code'; phone: string; code: string; error: string | null }
  | { step: 'complete'; phone: string };

interface PhoneVerificationScreenProps {
  state: PhoneVerificationViewState;
  title?: string;
  /** 가입 흐름의 단계. 다른 흐름은 생략한다. */
  step?: number;
  totalSteps?: number;
  /** 발송·확인 요청을 기다리는 중. 같은 요청을 중복으로 보내지 않게 버튼을 잠근다. */
  busy?: boolean;
  /** 요청 제한 남은 시간(초). 있으면 주 버튼을 막고 라벨에 남은 시간을 붙인다. */
  blockedSeconds?: number | null;
  /** 번호 입력 아래 덧붙이는 행동(가입 중 번호 충돌의 계정 찾기 등). */
  numberAction?: { label: string; disabled?: boolean; onPress: () => void };
  onBack: () => void;
  onChangePhone: (value: string) => void;
  onRequestCode: () => void;
  onEditPhone: () => void;
  onChangeCode: (value: string) => void;
  onResendCode: () => void;
  onVerify: () => void;
  /** 인증을 마친 뒤 다음 단계로 넘어간다. 없으면 완료 버튼은 표시만 한다. */
  onContinue?: () => void;
  continueLabel?: string;
}

// public/auth/phone-verification.png(485×720)의 비율. 높이만 정하고 너비는 그림에 맞춘다.
const COMPLETE_IMAGE_ASPECT_RATIO = 485 / 720;

function formatSignupPhone(value: string): string {
  return [value.slice(0, 3), value.slice(3, 7), value.slice(7, 11)].filter(Boolean).join(' ');
}

/** 서버/SDK 호출과 단계 전환을 포함하지 않는 표시 컴포넌트. */
export function PhoneVerificationScreen({
  state,
  title = '휴대전화 인증',
  step,
  totalSteps,
  busy = false,
  blockedSeconds = null,
  numberAction,
  onBack,
  onChangePhone,
  onRequestCode,
  onEditPhone,
  onChangeCode,
  onResendCode,
  onVerify,
  onContinue,
  continueLabel = '가입 완료하기',
}: PhoneVerificationScreenProps) {
  const footer = (() => {
    switch (state.step) {
      case 'number':
        return (
          <Button
            label={withRemainingTime('인증번호 받기', blockedSeconds)}
            size="lg"
            loading={busy}
            disabled={busy || blockedSeconds !== null || !/^010\d{8}$/.test(state.phone)}
            onPress={onRequestCode}
          />
        );
      case 'code':
        return (
          <Button
            label={withRemainingTime('인증 완료하기', blockedSeconds)}
            size="lg"
            loading={busy}
            disabled={busy || blockedSeconds !== null || state.code.length !== 6}
            onPress={onVerify}
          />
        );
      case 'complete':
        return onContinue ? (
          <Button label={continueLabel} size="lg" onPress={onContinue} />
        ) : (
          <Button label="인증 완료" size="lg" disabled onPress={onVerify} />
        );
    }
  })();

  return (
    <AuthScreenFrame
      title={title}
      step={step}
      totalSteps={totalSteps}
      onBack={onBack}
      footer={footer}
    >
      <View className={state.step === 'complete' ? 'flex-1' : undefined}>
        {state.step === 'number' ? (
          <View className="gap-content">
            <Text className="text-lg">휴대전화 번호</Text>
            <View
              className={`min-h-control-lg flex-row items-center gap-element rounded-control border bg-surface px-card ${state.error ? 'border-exam-danger' : 'border-line'}`}
            >
              <Text
                className="text-base !text-ink-muted"
                style={{ lineHeight: undefined, includeFontPadding: false }}
              >
                한국 +82
              </Text>
              <View className="h-6 w-px bg-line" accessible={false} />
              <TextInput
                accessibilityLabel="휴대전화 번호"
                autoComplete="tel-national"
                keyboardType="phone-pad"
                className="min-h-control-lg min-w-0 flex-1 p-0 text-base text-ink"
                style={{
                  fontFamily: FONT_FAMILY,
                  // 본문용 행간 대신 네이티브 단일 행 입력의 폰트 메트릭을 사용한다.
                  lineHeight: undefined,
                  includeFontPadding: false,
                  textAlignVertical: 'center',
                }}
                placeholder="010 1234 5678"
                placeholderTextColor={colors.ink.disabled}
                value={formatSignupPhone(state.phone)}
                onChangeText={(value) => onChangePhone(value.replace(/\D/g, '').slice(0, 11))}
              />
            </View>
            {state.error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="text-sm !text-exam-danger"
              >
                {state.error}
              </Text>
            ) : null}
            {numberAction ? (
              <Button
                label={numberAction.label}
                variant="secondary"
                disabled={busy || numberAction.disabled}
                onPress={numberAction.onPress}
              />
            ) : null}
          </View>
        ) : state.step === 'code' ? (
          <View className="gap-section">
            <View className="flex-row items-center justify-between border-b border-line pb-card">
              <Text className="text-lg">{formatSignupPhone(state.phone)}</Text>
              <Button label="수정" variant="text" size="sm" disabled={busy} onPress={onEditPhone} />
            </View>
            <View className="gap-content">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg">인증번호</Text>
                <Button
                  label="다시 받기"
                  variant="text"
                  size="sm"
                  disabled={busy}
                  onPress={onResendCode}
                />
              </View>
              <TextInput
                accessibilityLabel="인증번호 6자리"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                className={`min-h-control-lg rounded-control border bg-surface px-card py-0 text-base text-ink ${state.error ? 'border-exam-danger' : 'border-brand'}`}
                style={{
                  fontFamily: FONT_FAMILY,
                  // 본문용 행간 대신 네이티브 단일 행 입력의 폰트 메트릭을 사용한다.
                  lineHeight: undefined,
                  includeFontPadding: false,
                  textAlignVertical: 'center',
                }}
                placeholder="문자로 받은 6자리"
                placeholderTextColor={colors.ink.disabled}
                value={state.code}
                onChangeText={(value) => onChangeCode(value.replace(/\D/g, '').slice(0, 6))}
              />
              {state.error ? (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  className="text-sm !text-exam-danger"
                >
                  {state.error}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          // 2026-10-07 시안 A: 수화기 든 토끼가 튀어나오고, 인증한 번호를 마지막으로 보여 준다.
          <View
            className="flex-1 items-center justify-center gap-content"
            accessibilityLiveRegion="polite"
          >
            <Animated.View entering={ZoomIn.duration(duration.slow)}>
              <Image
                source={require('../../../public/auth/phone-verification.png')}
                className="h-44"
                style={{ aspectRatio: COMPLETE_IMAGE_ASPECT_RATIO }}
                resizeMode="contain"
                accessible={false}
              />
            </Animated.View>
            <Animated.View
              className="items-center gap-content"
              entering={FadeInDown.duration(duration.slow).delay(duration.base)}
            >
              <Text accessibilityRole="header" className="text-2xl">
                인증이 끝났어요
              </Text>
              <View className="flex-row items-center gap-xs rounded-pill border border-line bg-surface px-md py-xs">
                <View className="h-5 w-5 items-center justify-center rounded-pill bg-brand-cta">
                  <Feather name="check" size={size.icon.sm} color={colors.surface.DEFAULT} />
                </View>
                <Text className="text-base">{formatSignupPhone(state.phone)}</Text>
              </View>
            </Animated.View>
          </View>
        )}
      </View>
    </AuthScreenFrame>
  );
}
