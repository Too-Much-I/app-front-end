import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { LearningCheckResult } from '@/features/learning/learning-submission';
import { colors, size } from '@/theme';

const VERDICTS = {
  met: { label: '충족', icon: 'check-circle' },
  not_met: { label: '보완 필요', icon: 'minus-circle' },
  uncertain: { label: '확인 어려움', icon: 'help-circle' },
} as const;

export function LearningCheckResultCard({ result }: { result: LearningCheckResult }) {
  const [expandedId, setExpandedId] = useState<string | null>(
    () => result.items.find((item) => item.verdict !== 'met')?.id ?? null,
  );
  const [showTranscript, setShowTranscript] = useState(false);
  return (
    <View className="gap-lg">
      <View className="gap-sm">
        <Text accessibilityRole="header" className="text-xl font-semibold">
          답변 체크 결과
        </Text>
        <Text className="text-sm text-ink-muted">
          {result.totalCount}개 항목 중 {result.metCount}개 충족
        </Text>
      </View>
      <View className="overflow-hidden rounded-card border border-learning-paperLine bg-surface">
        {result.items.map((item, index) => {
          const expanded = expandedId === item.id;
          const verdict = VERDICTS[item.verdict];
          return (
            <View key={item.id} className={index ? 'border-t border-learning-paperLine' : ''}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.label}, ${verdict.label}`}
                accessibilityHint="눌러서 자세한 안내를 열거나 닫을 수 있어요."
                accessibilityState={{ expanded }}
                className="min-h-control-lg flex-row items-center gap-sm px-card py-md"
                onPress={() => setExpandedId(expanded ? null : item.id)}
              >
                <Feather
                  name={verdict.icon}
                  size={size.icon.sm}
                  color={item.verdict === 'met' ? colors.brand.text : colors.ink.muted}
                />
                <Text className="min-w-0 flex-1 text-sm font-semibold">{item.label}</Text>
                <Text
                  className={`text-xs ${item.verdict === 'met' ? '!text-brand-text' : 'text-ink-muted'}`}
                >
                  {verdict.label}
                </Text>
                <Feather
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={size.icon.sm}
                  color={colors.ink.muted}
                />
              </Pressable>
              {expanded ? (
                <View className="px-card pb-md">
                  <Text className="text-sm leading-6 text-ink-muted">{item.feedback}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showTranscript }}
          className="min-h-control-md flex-row items-center gap-sm"
          onPress={() => setShowTranscript((current) => !current)}
        >
          <Feather name="align-left" size={size.icon.sm} color={colors.ink.muted} />
          <Text className="flex-1 text-sm text-ink-muted">인식된 내 답변</Text>
          <Feather
            name={showTranscript ? 'chevron-up' : 'chevron-down'}
            size={size.icon.sm}
            color={colors.ink.muted}
          />
        </Pressable>
        {showTranscript ? (
          <View className="mt-sm rounded-control border border-learning-paperLine bg-surface p-card">
            <Text className="text-sm leading-6">{result.transcript}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
