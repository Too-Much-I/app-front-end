import { useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthScreenFrame } from '@/screens/auth/components/AuthScreenFrame';
import { SignupConsentRow } from '@/screens/auth/components/SignupConsentRow';
import { colors, FONT_FAMILY } from '@/theme';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';

interface SignupProfileScreenProps {
  draftStore: ReturnType<typeof createSignupDraftStore>;
  validateNickname?: (nickname: string) => string | null;
  onBack: () => void;
  onContinue: () => void;
  onOpenPolicy: (policy: 'terms' | 'privacy') => void;
}

export function SignupProfileScreen({
  draftStore,
  validateNickname,
  onBack,
  onContinue,
  onOpenPolicy,
}: SignupProfileScreenProps) {
  const nickname = useStore(draftStore, (draft) => draft.nickname);
  const consents = useStore(draftStore, (draft) => draft.consents);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const length = Array.from(nickname.trim()).length;
  const allChecked = consents.terms.agreed && consents.privacy.agreed;
  const canContinue = length >= 2 && length <= 20 && allChecked;

  return (
    <AuthScreenFrame
      title="회원가입"
      step={1}
      onBack={onBack}
      footer={
        <Button
          label="휴대전화 인증으로 계속하기"
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
      <View className="mt-section gap-content">
        <Text className="text-xl">시작하기 전에 확인해 주세요</Text>
        <SignupConsentRow
          label="약관 전체 동의"
          all
          checked={allChecked}
          onToggle={() => draftStore.setAllConsents(!allChecked)}
        />
        <View>
          <SignupConsentRow
            label="서비스 이용약관 동의"
            checked={consents.terms.agreed}
            onToggle={() => draftStore.setConsent('terms', !consents.terms.agreed)}
            onDetail={() => onOpenPolicy('terms')}
          />
          <SignupConsentRow
            label="개인정보 수집·이용 동의"
            checked={consents.privacy.agreed}
            onToggle={() => draftStore.setConsent('privacy', !consents.privacy.agreed)}
            onDetail={() => onOpenPolicy('privacy')}
          />
        </View>
      </View>
    </AuthScreenFrame>
  );
}
