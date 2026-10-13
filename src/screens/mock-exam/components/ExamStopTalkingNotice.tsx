import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { shadows } from '@/theme';

/**
 * 응답 시간이 끝나고 답변을 확정하는 동안(`finalizing`) 본문을 덮는 안내.
 *
 * 실제 TOEIC Speaking 시험 화면에 나오는 문구를 그대로 옮겼다. 시험과 같은 문장을 봐야
 * 실전에서 낯설지 않으므로 번역하지 않는다.
 */
export function ExamStopTalkingNotice() {
  return (
    <View
      accessibilityLiveRegion="assertive"
      className="absolute inset-0 items-center justify-center bg-ink/50 px-4"
    >
      <View
        accessibilityViewIsModal
        className="w-full max-w-lg overflow-hidden rounded-card bg-exam-navy"
        style={shadows.card}
      >
        <Text className="py-6 text-center text-4xl text-white">Stop Talking</Text>
        <View className="mx-4 mb-4 gap-6 rounded-2xl bg-surface px-6 py-10">
          <Text className="text-center text-lg leading-8">
            Your response time has ended.{'\n'}Stop speaking now.
          </Text>
          <Text className="text-center text-lg leading-8">
            You will automatically proceed to the next question after your response has been saved.
          </Text>
          <Text className="text-center text-lg leading-8">This may take several seconds.</Text>
        </View>
      </View>
    </View>
  );
}
