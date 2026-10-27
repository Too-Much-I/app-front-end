import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, shadows } from '@/theme';

interface LearningChalkboardProps {
  questionNumber: number;
  question: string;
  questionTranslation: string | null;
}

/**
 * 채점 화면의 질문 칠판(2026-10-27 시안 Q).
 *
 * 높이는 질문 길이만큼이다. 남는 높이를 다 채우면 짧은 질문에서 칠판이 너무 길어 보여서 뺐다(2026-10-27).
 * 시안은 손글씨체였지만 앱 글꼴은 Jua 하나라(AGENTS.md) 글자는 Jua로 쓴다.
 */
export function LearningChalkboard({
  questionNumber,
  question,
  questionTranslation,
}: LearningChalkboardProps) {
  const { learningChalkboard: palette } = colors;

  return (
    <View className="rounded-card p-sm" style={[shadows.card, { backgroundColor: palette.frame }]}>
      <View
        className="gap-element rounded-2xl border-2 p-card"
        style={{ backgroundColor: palette.board, borderColor: palette.frameEdge }}
      >
        <View className="flex-row items-center gap-sm">
          <View className="rounded-pill border-2 px-md" style={{ borderColor: palette.chalk }}>
            <Text className="text-lg" style={{ color: palette.chalk }}>
              Q{questionNumber}
            </Text>
          </View>
          <Text className="text-sm" style={{ color: palette.chalkMuted }}>
            질문
          </Text>
        </View>
        <Text className="text-2xl" style={{ color: palette.chalk }}>
          {question}
        </Text>
        {questionTranslation ? (
          <Text className="text-base" style={{ color: palette.chalkMuted }}>
            {questionTranslation}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
