import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trackEvent } from '@/lib/amplitude';
import type { LearningLessonParams } from '@/navigation/types';
import { LearningLoadError } from '@/screens/learning/components/LearningLoadError';
import { LearningLoading } from '@/screens/learning/components/LearningLoading';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import type { LearningLessonLookup } from '@/screens/learning/use-learning-lesson';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const passRabbit = require('../../../../public/mascots/pass_rabbit.png');

interface LearningLessonFallbackProps {
  lookup: Exclude<LearningLessonLookup, { status: 'found' }>;
  /** 이용권 안내 이벤트에 싣는 파트·등급. 화면의 route param을 그대로 넘긴다. */
  params: LearningLessonParams;
  onClose: () => void;
  onOpenPass: () => void;
}

/** 학습 단계 화면에서 문항을 아직 못 받았거나 못 찾았을 때. 닫기는 그대로 둔다. */
export function LearningLessonFallback({
  lookup,
  params,
  onClose,
  onOpenPass,
}: LearningLessonFallbackProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <LearningStepHeader onClose={onClose} title="학습" />
      <FallbackBody lookup={lookup} params={params} onClose={onClose} onOpenPass={onOpenPass} />
    </SafeAreaView>
  );
}

function FallbackBody({ lookup, params, onClose, onOpenPass }: LearningLessonFallbackProps) {
  switch (lookup.status) {
    case 'loading':
      return <LearningLoading />;
    case 'error':
      return <LearningLoadError onRetry={lookup.retry} />;
    case 'pass-required':
      return <PassRequiredNotice params={params} retry={lookup.retry} onOpenPass={onOpenPass} />;
    case 'missing':
      return (
        <LearningLoadError
          actionLabel="파트로 돌아가기"
          message="이 문항을 찾지 못했어요"
          onRetry={onClose}
        />
      );
  }
}

interface PassRequiredNoticeProps {
  params: LearningLessonParams;
  retry: () => void;
  onOpenPass: () => void;
}

/**
 * 유료 세트를 이용권 없이 열었을 때(2026-10-28 결정). 다시 불러와도 같으니 이용권 화면으로 보낸다.
 *
 * 안내가 보인 순간을 한 번 보낸다 — 그 뒤 결제로 이어지는지를 퍼널로 본다.
 *
 * 이용권 화면은 이 화면 위에 쌓였다가 돌아오므로, 다시 포커스될 때 세트 상세를 한 번 다시 받는다(2026-10-28
 * 리뷰 F1 뒤 결정). 결제했으면 문항이 열리고, 안 했으면 안내가 그대로 남는다. 처음 포커스는 `focus` 구독보다
 * 먼저라 받자마자 다시 받지 않는다.
 */
function PassRequiredNotice({ params, retry, onOpenPass }: PassRequiredNoticeProps) {
  const navigation = useNavigation();
  const { part, level } = params;
  useEffect(() => {
    trackEvent({ name: 'learning_pass_required', properties: { part, level } });
  }, [part, level]);
  useEffect(() => navigation.addListener('focus', retry), [navigation, retry]);

  return (
    <LearningLoadError
      actionLabel="이용권 보러 가기"
      image={passRabbit}
      message="추가적인 학습에는 이용권이 필요해요"
      onRetry={onOpenPass}
    />
  );
}
