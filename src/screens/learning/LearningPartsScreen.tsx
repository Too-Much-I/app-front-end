import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { LearningPart } from '@/features/learning/learning-level';
import {
  learningResumeQueryOptions,
  learningUnitsQueryOptions,
} from '@/features/learning/learning-queries';
import { pickNextLesson } from '@/features/learning/pick-next-lesson';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLoadError } from '@/screens/learning/components/LearningLoadError';
import { LearningLoading } from '@/screens/learning/components/LearningLoading';
import { LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { LEARNING_PART_SCENES } from '@/screens/learning/learning-part-scenes';
import { LEARNING_PART_ROWS } from '@/screens/learning/learning-parts';
import { colors, size } from '@/theme';
import type { LearningResume } from '@/types/learning';

type LearningPartsScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningParts'>;

/** 풍경 그림 높이. 시안(390px 폭)의 262px을 그대로 썼다. 폭이 넓으면 그림 양옆이 잘린다. */
const SCENE_HEIGHT = 262;
/** 아이콘을 바탕 없이 선만 두기로 해서(2026-10-22) 목록 기본 아이콘보다 한 단계 크게 둔다. */
const PART_ICON_SIZE = 28;
/**
 * 이어서 하기 카드가 풍경 아래쪽에 걸치는 높이의 비율. 시안 A(2026-10-27)의 56px / 풍경 262px이다.
 * 풍경 높이를 바꿔도 같은 비율로 걸치도록 px이 아니라 비율로 둔다(2026-10-27 결정).
 */
const RESUME_CARD_OVERLAP_RATIO = 56 / 262;

/** 이어서 하기 카드의 위 줄. 세 상태 모두 들어갈 위치가 있어 카드를 보이고 이 줄만 다르게 한다. */
const RESUME_LABELS = {
  READY: '지난번 멈춘 곳',
  NO_HISTORY: '처음 시작해요',
  END_OF_PART: '다음 학습',
} as const satisfies Record<LearningResume['status'], string>;

/**
 * 학습 파트 고르기(시안 B).
 *
 * 위는 등급별 풍경, 아래는 파트 목록이다. 파트를 누르면 서버 완료 기록 기준으로 아직 안 한 문항을 골라
 * 바로 들어간다(세트 목록 화면 없음). 목록은 서버에서 받고, 하나라도 못 받으면 토끼와 다시 불러오기를 보여 준다.
 *
 * 풍경 아래쪽에는 서버가 알려 준 이어서 하기 위치를 카드로 걸친다(시안 A, 2026-10-27). 그 응답을 아직 못
 * 받았거나 실패하면 카드만 빼고 나머지는 그대로 둔다.
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
  const { data: resume } = useQuery(learningResumeQueryOptions(level));

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
    if (pick.kind === 'next') {
      openLesson(part, pick.unitId, pick.lessonId);
    } else {
      openLesson(part, pick.firstUnitId, pick.firstLessonId);
    }
  }

  function openLesson(part: LearningPart, unitId: string, lessonId: string) {
    // Part 1은 퍼즐 조각이 없어 듣기·쉐도잉부터 한다. 이어서 하기도 같은 규칙이다(2026-10-27 결정).
    navigation.navigate(part === 1 ? 'LearningShadowing' : 'LearningPuzzle', {
      level,
      part,
      unitId,
      lessonId,
    });
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

        {resume ? (
          <ResumeCard
            color={card.color}
            resume={resume}
            onPress={() => openLesson(resume.part, resume.unitId, resume.lessonId)}
          />
        ) : null}

        <Text accessibilityRole="header" className="px-screen pb-element pt-card text-xl">
          {resume ? '다른 파트 고르기' : '어떤 파트부터 시작할까요?'}
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

interface ResumeCardProps {
  resume: LearningResume;
  /** 등급 카드 색. 버튼 바탕에 쓴다. */
  color: string;
  onPress: () => void;
}

/**
 * 풍경 아래쪽에 걸친 이어서 하기 카드. 왼쪽은 위치, 오른쪽은 등급 색 버튼이다.
 *
 * 버튼은 등급 카드 CTA(`LearningLevelScreen`)처럼 직접 그린다. 공용 Button은 색을 variant로만 고르는데,
 * 등급 색을 variant로 올리면 공용 버튼이 학습 등급을 알게 된다(2026-10-27 리뷰 F1 뒤 결정).
 */
function ResumeCard({ resume, color, onPress }: ResumeCardProps) {
  const partName = LEARNING_PART_ROWS.find((row) => row.part === resume.part)?.name ?? '';
  const position = `${resume.unitNumber}세트 · ${resume.lessonNumber}번째 문항부터`;

  return (
    <View
      className="mx-lg flex-row items-center gap-md rounded-card bg-surface p-card"
      style={{ marginTop: -SCENE_HEIGHT * RESUME_CARD_OVERLAP_RATIO }}
    >
      <View className="flex-1 gap-xs">
        <Text className="text-xs text-ink-muted">{RESUME_LABELS[resume.status]}</Text>
        <Text className="text-lg" numberOfLines={1}>
          Part {resume.part} {partName}
        </Text>
        <Text className="text-sm text-ink-muted">{position}</Text>
      </View>
      <Pressable
        accessibilityHint={`Part ${resume.part} ${partName} ${position} 시작합니다`}
        accessibilityRole="button"
        className="min-h-control-lg flex-row items-center gap-xs rounded-control px-lg"
        style={{ backgroundColor: color }}
        onPress={onPress}
      >
        <Feather name="play" size={size.icon.md} color={colors.ink.DEFAULT} />
        <Text className="text-base">이어서 하기</Text>
      </Pressable>
    </View>
  );
}
