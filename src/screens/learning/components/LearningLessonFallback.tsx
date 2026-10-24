import { SafeAreaView } from 'react-native-safe-area-context';

import { LearningLoadError } from '@/screens/learning/components/LearningLoadError';
import { LearningLoading } from '@/screens/learning/components/LearningLoading';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import type { LearningLessonLookup } from '@/screens/learning/use-learning-lesson';

interface LearningLessonFallbackProps {
  lookup: Exclude<LearningLessonLookup, { status: 'found' }>;
  onClose: () => void;
}

/** 학습 단계 화면에서 문항을 아직 못 받았거나 못 찾았을 때. 닫기는 그대로 둔다. */
export function LearningLessonFallback({ lookup, onClose }: LearningLessonFallbackProps) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <LearningStepHeader onClose={onClose} title="학습" />
      {lookup.status === 'loading' ? (
        <LearningLoading />
      ) : lookup.status === 'error' ? (
        <LearningLoadError onRetry={lookup.retry} />
      ) : (
        <LearningLoadError
          actionLabel="파트로 돌아가기"
          message="이 문항을 찾지 못했어요"
          onRetry={onClose}
        />
      )}
    </SafeAreaView>
  );
}
