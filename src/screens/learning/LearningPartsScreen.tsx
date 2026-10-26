import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueries } from '@tanstack/react-query';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { LearningPart } from '@/features/learning/learning-level';
import { learningUnitsQueryOptions } from '@/features/learning/learning-queries';
import { pickNextLesson } from '@/features/learning/pick-next-lesson';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLoadError } from '@/screens/learning/components/LearningLoadError';
import { LearningLoading } from '@/screens/learning/components/LearningLoading';
import { LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { LEARNING_PART_SCENES } from '@/screens/learning/learning-part-scenes';
import { LEARNING_PART_ROWS } from '@/screens/learning/learning-parts';
import { colors, size } from '@/theme';

type LearningPartsScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningParts'>;

/** 풍경 그림 높이. 시안(390px 폭)의 262px을 그대로 썼다. 폭이 넓으면 그림 양옆이 잘린다. */
const SCENE_HEIGHT = 262;
/** 아이콘을 바탕 없이 선만 두기로 해서(2026-10-22) 목록 기본 아이콘보다 한 단계 크게 둔다. */
const PART_ICON_SIZE = 28;

/**
 * 학습 파트 고르기(시안 B).
 *
 * 위는 등급별 풍경, 아래는 파트 목록이다. 파트를 누르면 서버 완료 기록 기준으로 아직 안 한 문항을 골라
 * 바로 들어간다(세트 목록 화면 없음). "이어서 하기"는 마지막 학습 파트를 알려 주는 API를 서버에 요청해
 * 두어(2026-10-26 결정) 그 전까지 두지 않는다.
 * 목록은 서버에서 받고, 하나라도 못 받으면 토끼와 다시 불러오기를 보여 준다.
 */
export function LearningPartsScreen({ navigation, route }: LearningPartsScreenProps) {
  const { level } = route.params;
  const card = LEVEL_CARDS[level];
  const scene = LEARNING_PART_SCENES[level];
  const insets = useSafeAreaInsets();

  // 완료 수는 서버 값이다. Part 1 완료 저장과 Part 2~5 채점 완료 뒤 그 파트 목록 캐시를 무효화해 다시 읽는다.
  // 파트마다 완료 수를 보여 줘야 해서 다섯 파트 목록을 함께 받는다.
  const unitQueries = useQueries({
    queries: LEARNING_PART_ROWS.map((row) => learningUnitsQueryOptions(row.part, level)),
  });
  // 다시 불러오는 동안은 실패 화면 대신 원을 돌린다. 실패한 쿼리도 다시 받는 중에는 `isError`가 남아 있다.
  const failedQueries = unitQueries.filter((query) => query.isError && !query.isFetching);
  const isLoading = unitQueries.some((query) => query.data === undefined);
  const retryFailed = () => failedQueries.forEach((query) => void query.refetch());

  const rows = LEARNING_PART_ROWS.map((row, index) => {
    const units = unitQueries[index]?.data ?? [];
    const doneUnits = units.filter((unit) => unit.lessons.every((lesson) => lesson.completed));
    return { ...row, units, doneCount: doneUnits.length, totalCount: units.length };
  });

  function startPart(part: LearningPart) {
    const row = rows.find((candidate) => candidate.part === part);
    if (!row) return;
    const pick = pickNextLesson(row.units);
    if (pick.kind === 'empty') return;
    // 다 끝낸 파트는 첫 세트부터 다시 한다(AI 제안, 2026-10-22).
    const params =
      pick.kind === 'next'
        ? { level, part, unitId: pick.unitId, lessonId: pick.lessonId }
        : { level, part, unitId: pick.firstUnitId, lessonId: pick.firstLessonId };
    // Part 1은 퍼즐 조각이 없어 듣기·쉐도잉부터 한다.
    navigation.navigate(part === 1 ? 'LearningShadowing' : 'LearningPuzzle', params);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: scene.ground }}>
      <ScrollView contentContainerClassName="pb-section">
        <View style={{ height: SCENE_HEIGHT }}>
          <Image
            accessibilityLabel={scene.imageLabel}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
            source={scene.image}
          />
          <View
            className="flex-row items-center justify-between px-lg"
            style={{ paddingTop: insets.top }}
          >
            <Pressable
              accessibilityLabel="뒤로 가기"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-full bg-surface"
              onPress={navigation.goBack}
            >
              <Feather name="arrow-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
            </Pressable>
            {/* 등급은 이 화면에서 바꾸지 않는다. 바꾸려면 카드 화면으로 돌아가 다시 고른다. */}
            <Pressable
              accessibilityHint="등급 카드 화면으로 돌아갑니다"
              accessibilityLabel={`목표 ${card.label}, 바꾸기`}
              accessibilityRole="button"
              className="min-h-control-sm justify-center rounded-pill px-md"
              style={{ backgroundColor: card.color }}
              onPress={navigation.goBack}
            >
              <Text className="text-sm">목표 {card.label} · 바꾸기</Text>
            </Pressable>
          </View>
        </View>

        <Text accessibilityRole="header" className="px-screen pb-element pt-card text-xl">
          어떤 파트부터 시작할까요?
        </Text>

        {failedQueries.length > 0 ? (
          <LearningLoadError onRetry={retryFailed} />
        ) : isLoading ? (
          <LearningLoading />
        ) : (
          <View className="gap-element px-lg">
            {rows.map((row) => (
              <Pressable
                key={row.part}
                accessibilityHint="아직 안 한 문항부터 시작합니다"
                accessibilityLabel={`Part ${row.part} ${row.name}. ${row.totalCount}세트 중 ${row.doneCount}세트 끝냄`}
                accessibilityRole="button"
                className="flex-row items-center gap-md rounded-card bg-surface py-md pl-lg pr-md"
                disabled={row.totalCount === 0}
                onPress={() => startPart(row.part)}
              >
                <Feather name={row.icon} size={PART_ICON_SIZE} color={colors.ink.DEFAULT} />
                <View className="flex-1 gap-xs">
                  <Text className="text-lg">{row.name}</Text>
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    Part {row.part} · {row.sharedAcrossLevels ? '등급 공통' : row.description}
                  </Text>
                </View>
                <Text className="text-sm text-ink-muted">
                  {row.doneCount}/{row.totalCount}
                </Text>
                <View className="h-12 w-12 items-center justify-center rounded-control bg-surface-muted">
                  <Feather name="play" size={size.icon.md} color={colors.ink.DEFAULT} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
