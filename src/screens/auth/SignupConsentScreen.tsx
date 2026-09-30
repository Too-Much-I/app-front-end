import { ActivityIndicator, View } from 'react-native';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { createSignupDraftStore } from '@/features/auth/signup-draft-store';
import { AuthScreenFrame } from '@/screens/auth/components/AuthScreenFrame';
import { SignupConsentRow } from '@/screens/auth/components/SignupConsentRow';
import { colors } from '@/theme';

// 재동의 화면(ConsentScreen)과 같은 문구다. 화면 영역이 달라 공유하지 않고 옮겨 적었다.
const QUALITY_REVIEW_LABEL = '채점 품질 개선을 위한 답변 검토';
const QUALITY_REVIEW_DESCRIPTION =
  '채점이 잘못되거나 오류가 났을 때 담당자가 해당 답변 음성과 전사문을 직접 확인해 원인을 찾습니다. 동의하지 않아도 모의고사 응시와 채점 결과 확인에는 제한이 없어요.';

interface SignupConsentScreenProps {
  draftStore: ReturnType<typeof createSignupDraftStore>;
  step: number;
  totalSteps: number;
  /** 약관 버전을 받는 중. 버전이 없으면 store가 동의를 막으므로 체크도 잠근다. */
  loading: boolean;
  continueLabel: string;
  onBack: () => void;
  onContinue: () => void;
  onOpenPolicy: (policy: 'terms' | 'privacy') => void;
}

export function SignupConsentScreen({
  draftStore,
  step,
  totalSteps,
  loading,
  continueLabel,
  onBack,
  onContinue,
  onOpenPolicy,
}: SignupConsentScreenProps) {
  const consents = useStore(draftStore, (draft) => draft.consents);
  const requiredChecked = consents.terms.agreed && consents.privacy.agreed;
  // 전체 동의는 선택 항목까지 포함해야 켜진다. 필수만 체크해도 계속할 수 있다.
  const allChecked = requiredChecked && consents.qualityReview.agreed;

  return (
    <AuthScreenFrame
      title="회원가입"
      step={step}
      totalSteps={totalSteps}
      onBack={onBack}
      footer={
        <Button
          label={continueLabel}
          size="lg"
          disabled={loading || !requiredChecked}
          onPress={onContinue}
        />
      }
    >
      <View className="gap-content">
        <Text accessibilityRole="header" className="text-3xl">
          시작하기 전에 확인해 주세요
        </Text>
        <Text className="text-sm text-ink-muted">
          서비스 이용을 위해 아래 약관에 동의해 주세요.
        </Text>
      </View>
      {loading ? (
        <View className="mt-section flex-row items-center gap-element">
          <ActivityIndicator color={colors.brand.text} />
          <Text accessibilityLiveRegion="polite" className="text-sm text-ink-muted">
            약관 정보를 불러오고 있어요.
          </Text>
        </View>
      ) : null}
      <View className="mt-section gap-content">
        <SignupConsentRow
          label="약관 전체 동의 (선택 항목 포함)"
          all
          checked={allChecked}
          disabled={loading}
          onToggle={() => draftStore.setAllConsents(!allChecked)}
        />
        <View>
          <SignupConsentRow
            label="서비스 이용약관 동의"
            checked={consents.terms.agreed}
            disabled={loading}
            onToggle={() => draftStore.setConsent('terms', !consents.terms.agreed)}
            onDetail={() => onOpenPolicy('terms')}
          />
          <SignupConsentRow
            label="개인정보 수집·이용 동의"
            checked={consents.privacy.agreed}
            disabled={loading}
            onToggle={() => draftStore.setConsent('privacy', !consents.privacy.agreed)}
            onDetail={() => onOpenPolicy('privacy')}
          />
          <SignupConsentRow
            label={QUALITY_REVIEW_LABEL}
            optional
            checked={consents.qualityReview.agreed}
            disabled={loading}
            onToggle={() => draftStore.setConsent('qualityReview', !consents.qualityReview.agreed)}
          />
          <Text className="pl-card text-xs leading-5 text-ink-muted">
            {QUALITY_REVIEW_DESCRIPTION}
          </Text>
        </View>
      </View>
    </AuthScreenFrame>
  );
}
