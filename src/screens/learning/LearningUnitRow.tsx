import { LearningRemoteImage } from '@/screens/learning/LearningRemoteImage';
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { getLearningUnitProgress } from '@/features/learning/learning-catalog-state';
import { getLearningStageLabel } from '@/features/learning/learning-progress';
import type { LearningStage, LearningUnit } from '@/features/learning/learning-types';
import { colors, size } from '@/theme';

const PART_ICONS = ['file-text', 'image', 'message-circle', 'calendar', 'mic'] as const;

export function LearningUnitRow({
  unit,
  expanded,
  status,
  onToggle,
  onStart,
}: {
  unit: LearningUnit;
  expanded: boolean;
  status: ReturnType<typeof getLearningUnitProgress>;
  onToggle: () => void;
  onStart: (stage?: LearningStage, questionIndex?: number) => void;
}) {
  const { completed, completedCount } = status;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = status.questions[selectedIndex ?? 0];
  const questionNumber = unit.questionNumbers[0];
  const questions =
    unit.lessonIds.length === 3
      ? `Q${questionNumber}–${(questionNumber ?? 0) + 2}`
      : `Q${questionNumber}`;
  return (
    <View
      className={`overflow-hidden rounded-card border ${completed ? 'bg-surface-muted' : 'bg-surface'} ${expanded ? 'border-brand-300' : 'border-line'}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${unit.title}, ${questions}, ${completed ? '학습 완료, ' : ''}학습 단계 ${expanded ? '접기' : '펼치기'}`}
        onPress={() => {
          setSelectedIndex(null);
          onToggle();
        }}
        className="min-h-20 flex-row items-center gap-element px-card py-element"
      >
        {unit.thumbnail ? (
          <LearningRemoteImage
            media={unit.thumbnail}
            resizeMode="cover"
            className="h-11 w-11 rounded-control"
          />
        ) : (
          <View
            className={`h-11 w-11 items-center justify-center rounded-pill ${completed ? 'bg-line' : 'bg-brand-50'}`}
          >
            <Feather
              name={PART_ICONS[unit.part - 1]}
              size={size.icon.md}
              color={completed ? colors.ink.muted : colors.brand.text}
            />
          </View>
        )}
        <Text numberOfLines={1} className="min-w-0 flex-1 text-base font-semibold">
          {unit.title}
        </Text>
        <View className="shrink-0 items-end gap-xs">
          <Text className="text-xs text-ink-muted">{questions}</Text>
          {completed ? (
            <View className="flex-row items-center gap-xs rounded-pill bg-line px-sm py-xs">
              <Feather name="check" size={size.icon.sm} color={colors.ink.DEFAULT} />
              <Text className="text-xs font-semibold">완료</Text>
            </View>
          ) : (
            <Text className="text-xs text-ink-muted">
              {completedCount > 0
                ? `${completedCount}/${unit.lessonIds.length} 완료`
                : `${unit.lessonIds.length}문항`}
            </Text>
          )}
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={size.icon.sm}
          color={expanded ? colors.brand.text : colors.ink.muted}
        />
      </Pressable>
      {expanded ? (
        <View className="gap-md px-card pb-card">
          {unit.lessonIds.length > 1 ? (
            <View
              accessibilityRole="tablist"
              accessibilityLabel="연습할 문항"
              className="flex-row border-b border-line"
            >
              {status.questions.map((q) => (
                <Pressable
                  key={q.index}
                  accessibilityRole="tab"
                  accessibilityLabel={`Q${q.number}${q.completed ? ', 완료' : ''}`}
                  accessibilityState={{ selected: selected.index === q.index }}
                  className={`min-h-11 flex-1 flex-row items-center justify-center gap-xs border-b-2 ${selected.index === q.index ? 'border-brand' : 'border-transparent'}`}
                  onPress={() => setSelectedIndex(q.index)}
                >
                  <Text
                    className={`text-sm ${selected.index === q.index ? '!text-brand-text' : 'text-ink-muted'}`}
                  >
                    Q{q.number}
                  </Text>
                  {q.completed ? (
                    <Feather name="check" size={size.icon.sm} color={colors.ink.muted} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button
            label={selected.completed ? '다시 연습하기' : '학습 시작'}
            onPress={() => onStart('listen', selected.index)}
          />
          {unit.lessonIds.length === 1 ? (
            <View className="flex-row gap-xs">
              {(['listen', 'shadow', 'practice'] as const).map((stage) => (
                <View key={stage} className="flex-1">
                  <Button
                    size="sm"
                    variant="neutral"
                    label={getLearningStageLabel(stage, unit.part)}
                    onPress={() => onStart(stage, 0)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
