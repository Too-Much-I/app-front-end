import { useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { canCompleteSignupNickname } from '@/features/auth/signup-flow';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import {
  checkReferralCodeFormat,
  normalizeReferralCodeInput,
  REFERRAL_CODE_FORMAT_MESSAGES,
} from '@/features/referral/referral-code-format';
import { AuthScreenFrame } from '@/screens/auth/components/AuthScreenFrame';
import { colors, FONT_FAMILY } from '@/theme';

interface SignupNicknameScreenProps {
  draftStore: ReturnType<typeof createSignupDraftStore>;
  step: number;
  totalSteps: number;
  /** 미리보기 전용 중복 확인. 실제 가입은 서버가 제출 시 검증한다. */
  validateNickname?: (nickname: string) => string | null;
  onBack: () => void;
  onContinue: () => void;
}

export function SignupNicknameScreen({
  draftStore,
  step,
  totalSteps,
  validateNickname,
  onBack,
  onContinue,
}: SignupNicknameScreenProps) {
  const nickname = useStore(draftStore, (draft) => draft.nickname);
  const canContinue = useStore(draftStore, canCompleteSignupNickname);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const length = Array.from(nickname.trim()).length;

  return (
    <AuthScreenFrame
      title="회원가입"
      step={step}
      totalSteps={totalSteps}
      onBack={onBack}
      footer={
        <Button
          label="다음"
          size="lg"
          disabled={!canContinue}
          onPress={() => {
            const error = validateNickname?.(nickname) ?? null;
            setNicknameError(error);
            if (!error) onContinue();
          }}
        />
      }
    >
      <View className="items-center gap-content">
        <Image
          source={require('../../../public/auth/curious-rabbit.png')}
          className="h-36 w-36"
          resizeMode="contain"
          accessible={false}
        />
        <Text accessibilityRole="header" className="text-center text-3xl">
          어떻게 불러드릴까요?
        </Text>
        <Text className="text-center text-sm text-ink-muted">
          토선생이 불러드릴 닉네임을 알려주세요.
        </Text>
      </View>
      <View className="mt-section gap-content">
        <Text className="text-base">닉네임</Text>
        <TextInput
          accessibilityLabel="닉네임"
          accessibilityHint="앞뒤 공백을 제외하고 2자에서 20자로 입력해주세요"
          autoCapitalize="none"
          autoCorrect={false}
          className={`min-h-control-lg rounded-control border bg-surface px-card py-0 text-base text-ink ${nicknameError ? 'border-exam-danger' : 'border-line'}`}
          // iOS 단일 행 입력은 본문용 lineHeight를 주면 Jua 기준선이 아래로 밀린다.
          style={{
            fontFamily: FONT_FAMILY,
            lineHeight: undefined,
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
          placeholder="닉네임을 입력해 주세요"
          placeholderTextColor={colors.ink.disabled}
          value={nickname}
          onChangeText={(value) => {
            draftStore.setNickname(value);
            setNicknameError(null);
          }}
          returnKeyType="done"
        />
        {nicknameError ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="text-sm !text-exam-danger"
          >
            {nicknameError}
          </Text>
        ) : null}
        <View className="flex-row justify-between gap-content">
          <Text className={`text-sm ${length > 20 ? '!text-exam-danger' : 'text-ink-muted'}`}>
            2~20자로 입력해 주세요.
          </Text>
          <Text className="text-sm text-ink-muted">{length} / 20</Text>
        </View>
      </View>
      <ReferralCodeField draftStore={draftStore} />
    </AuthScreenFrame>
  );
}

/**
 * 추천 코드 입력 칸(2026-10-29 시안 A·D6 결정). 선택 입력이고 서버에는 가입이 끝난 뒤에 보낸다. 입력하면서
 * 대문자로 바꾸고 공백을 뺀다. 형식 안내는 칸을 벗어날 때만 띄우고, 글자는 칸에 그대로 둔다.
 */
function ReferralCodeField({
  draftStore,
}: {
  draftStore: SignupNicknameScreenProps['draftStore'];
}) {
  const referralCode = useStore(draftStore, (draft) => draft.referralCode);
  const [hasLeftField, setHasLeftField] = useState(false);
  const message = hasLeftField
    ? REFERRAL_CODE_FORMAT_MESSAGES[checkReferralCodeFormat(referralCode)]
    : null;

  return (
    <View className="mt-section gap-content">
      <View className="flex-row items-baseline gap-sm">
        <Text className="text-base">추천 코드</Text>
        <Text className="text-xs text-ink-muted">선택</Text>
      </View>
      <TextInput
        accessibilityLabel="추천 코드 (선택)"
        accessibilityHint="친구에게 받은 10자리 코드를 입력해 주세요"
        autoCapitalize="characters"
        autoCorrect={false}
        className={`min-h-control-lg rounded-control border bg-surface px-card py-0 text-base text-ink ${message ? 'border-exam-danger' : 'border-line'}`}
        // 닉네임 칸과 같은 이유로 iOS 단일 행 lineHeight를 비운다.
        style={{
          fontFamily: FONT_FAMILY,
          lineHeight: undefined,
          includeFontPadding: false,
          textAlignVertical: 'center',
        }}
        placeholder="친구에게 받은 코드 10자리"
        placeholderTextColor={colors.ink.disabled}
        value={referralCode}
        onChangeText={(value) => draftStore.setReferralCode(normalizeReferralCodeInput(value))}
        onFocus={() => setHasLeftField(false)}
        onBlur={() => setHasLeftField(true)}
        returnKeyType="done"
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="text-sm !text-exam-danger"
        >
          {message}
        </Text>
      ) : (
        <Text className="text-sm text-ink-muted">입력하면 나와 친구 모두 모의고사권 1장</Text>
      )}
    </View>
  );
}
