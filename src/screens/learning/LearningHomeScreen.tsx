import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { learningUnitsQuery } from '@/features/learning/learning-queries';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { getLearningCatalogState } from '@/features/learning/learning-catalog-state';
import type { LearningLevel, LearningUnit } from '@/features/learning/learning-types';
import type { LearningStackParamList } from '@/navigation/types';
import { colors, layout, shadows, size, spacing } from '@/theme';

import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { LearningUnitRow } from '@/screens/learning/LearningUnitRow';
import { LearningLevelSelect } from '@/screens/learning/LearningLevelSelect';

const PART_NAMES = ['지문 읽기', '사진 묘사', '질문에 답하기', '표 보고 답하기', '의견 말하기'];
export function LearningHomeScreen({
  navigation,
}: NativeStackScreenProps<LearningStackParamList, 'LearningHome'>) {
  const listRef = useRef<FlatList<LearningUnit>>(null);
  const { height } = useWindowDimensions();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [part, setPart] = useState(2);
  const [filter, setFilter] = useState<'all' | 'completed'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [level, setLevel] = useState<LearningLevel>('IM3');
  const query = useQuery(learningUnitsQuery(part, level));
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const units = query.data ?? [];
  const keys = new Set(
    units.flatMap((unit) =>
      unit.completedLessonIds.map(
        (id) => `learning-complete:${id}:${part === 1 ? 'common' : level}`,
      ),
    ),
  );
  const summaries = new Map(
    units.flatMap((unit) =>
      unit.lessonIds.map((id, i) => [id, { questionNumber: unit.questionNumbers[i] }] as const),
    ),
  );
  const catalog = getLearningCatalogState(units, keys, level, summaries);
  const visibleUnits = filter === 'completed' ? catalog.completed : catalog.all;
  const selectLevel = (value: LearningLevel) => {
    setLevel(value);
    setExpandedId(null);
  };
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-surface-subtle">
      <FlatList
        ref={listRef}
        data={visibleUnits}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onScroll={(event) => setShowScrollTop(event.nativeEvent.contentOffset.y > height * 0.6)}
        scrollEventThrottle={100}
        contentContainerStyle={{
          paddingHorizontal: layout.screen,
          // Keep the last card's shortcuts above the floating 48 pt scroll-to-top button.
          paddingBottom: size.control.lg + spacing.lg * 2,
          gap: spacing.sm,
        }}
        ListHeaderComponent={
          <View className="gap-lg pb-xs">
            {query.isError && query.data ? (
              <Text className="text-sm text-ink-muted">
                목록을 새로 가져오지 못했어요. 아래로 당겨 다시 시도해 주세요.
              </Text>
            ) : null}
            <View className="h-14 flex-row items-center justify-between">
              <Text accessibilityRole="header" className="text-2xl font-bold">
                학습
              </Text>
            </View>
            <SegmentedTabs
              label="학습 종류"
              value="answers"
              onChange={() => undefined}
              items={[
                { value: 'answers', label: '답변 익히기' },
                { value: 'weakness', label: '약점 훈련', disabled: true, badge: '준비 중' },
              ]}
            />
            <View
              accessibilityRole="tablist"
              accessibilityLabel="학습 파트 선택"
              className="flex-row gap-sm pt-sm"
            >
              {PART_NAMES.map((name, index) => (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityLabel={`Part ${index + 1} ${name}`}
                  accessibilityState={{ selected: part === index + 1 }}
                  onPress={() => {
                    setPart(index + 1);
                    setExpandedId(null);
                  }}
                  className={`h-11 flex-1 items-center justify-center rounded-pill border ${part === index + 1 ? 'border-learning-part bg-learning-part' : 'border-line bg-surface'}`}
                >
                  <Text
                    className={`text-sm font-medium ${part === index + 1 ? 'text-white' : 'text-ink-muted'}`}
                  >
                    Part {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row items-center justify-between gap-sm pt-sm">
              <View
                accessibilityRole="tablist"
                accessibilityLabel="학습 목록 필터"
                className="flex-row gap-xl"
              >
                {(['all', 'completed'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filter === value }}
                    onPress={() => setFilter(value)}
                    className={`min-h-11 items-center justify-center border-b-2 px-xs ${filter === value ? 'border-ink' : 'border-transparent'}`}
                  >
                    <Text
                      className={`text-sm ${filter === value ? 'font-semibold text-ink' : 'text-ink-muted'}`}
                    >
                      {value === 'all'
                        ? `전체 ${units.length}`
                        : `완료 ${catalog.completed.length}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {part !== 1 ? <LearningLevelSelect value={level} onChange={selectLevel} /> : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center gap-md py-section">
            {query.isPending ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text className="text-center text-sm text-ink-muted">
                  {query.isError
                    ? '학습 목록을 불러오지 못했어요.'
                    : filter === 'completed'
                      ? '아직 완료한 학습이 없어요.'
                      : '학습 콘텐츠를 준비하고 있어요.'}
                </Text>
                {query.isError ? (
                  <Button
                    label="다시 불러오기"
                    variant="secondary"
                    onPress={() => void query.refetch()}
                  />
                ) : filter === 'completed' ? (
                  <Button
                    label="전체 목록 보기"
                    variant="secondary"
                    onPress={() => setFilter('all')}
                  />
                ) : null}
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <LearningUnitRow
            unit={item}
            expanded={expandedId === item.id}
            status={catalog.statuses.get(item.id)!}
            onToggle={() => setExpandedId((current) => (current === item.id ? null : item.id))}
            onStart={(initialStage, questionIndex) =>
              navigation.navigate('LearningSession', {
                unitId: item.id,
                level,
                initialStage,
                questionIndex,
              })
            }
          />
        )}
      />
      {showScrollTop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="목록 맨 위로"
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          className="absolute bottom-lg right-screen h-12 w-12 items-center justify-center rounded-pill border border-line bg-surface"
          style={shadows.card}
        >
          <Feather name="arrow-up" size={size.icon.lg} color={colors.ink.DEFAULT} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
