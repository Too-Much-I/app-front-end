import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
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
import { LEVEL_CARDS } from '@/screens/learning/learning-level-cards';
import { LEARNING_PART_SCENES } from '@/screens/learning/learning-part-scenes';
import { LEARNING_PART_ROWS } from '@/screens/learning/learning-parts';
import { colors, size } from '@/theme';
import type { LearningResume, LearningUnitSummary } from '@/types/learning';

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

/** 응답을 받기 전에 눌러 그 자리에서 기다리는 박스. 파트 줄이거나 이어서 하기 카드다. */
type WaitingBox = LearningPart | 'resume';

/**
 * 학습 파트 고르기(시안 B).
 *
 * 위는 등급별 풍경, 아래는 파트 목록이다. 파트를 누르면 서버 완료 기록 기준으로 아직 안 한 문항을 골라
 * 바로 들어간다(세트 목록 화면 없음). 목록은 서버에서 받고, 하나라도 못 받으면 토끼와 다시 불러오기를 보여 준다.
 *
 * 풍경 아래쪽에는 서버가 알려 준 이어서 하기 위치를 카드로 걸친다(시안 A, 2026-10-27).
 *
 * 파트 줄과 이어서 하기 카드는 응답을 기다리지 않고 먼저 그린다. 진행 숫자와 카드 문구는 오면 채우고, 오기
 * 전에 누르면 그 박스에서 기다렸다가 이동한다. 이어서 하기를 못 받으면 카드를 치우지 않고 그 안에 알린다
 * (2026-10-28 결정, 10-27 "실패하면 카드만 숨김"을 바꿈).
 */
export function LearningPartsScreen({ navigation, route }: LearningPartsScreenProps) {
  const { level } = route.params;
  const card = LEVEL_CARDS[level];
  const scene = LEARNING_PART_SCENES[level];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [waitingBox, setWaitingBox] = useState<WaitingBox | null>(null);

  // 완료 수는 서버 값이다. Part 1 완료 저장과 Part 2~5 채점 완료 뒤 그 파트 목록 캐시를 무효화해 다시 읽는다.
  // 파트마다 완료 수를 보여 줘야 해서 다섯 파트 목록을 함께 받는다. 캐시는 디스크에 남아 있으면 다시 받지 않는다.
  const unitQueries = useQueries({
    queries: LEARNING_PART_ROWS.map((row) => learningUnitsQueryOptions(row.part, level)),
  });
  // 다시 불러오는 동안은 실패 화면 대신 줄을 그린다. 실패한 쿼리도 다시 받는 중에는 `isError`가 남아 있다.
  const failedQueries = unitQueries.filter((query) => query.isError && !query.isFetching);
  const retryFailed = () => failedQueries.forEach((query) => void query.refetch());
  const resumeQuery = useQuery(learningResumeQueryOptions(level));
  const resume = resumeQuery.data;
  const isResumeFailed = resume === undefined && resumeQuery.isError && !resumeQuery.isFetching;

  // 목록을 아직 못 받은 줄은 `progress`가 `null`이다. 숫자 없이 그리고, 누르면 그 자리에서 받는다.
  const rows = LEARNING_PART_ROWS.map((row, index) => {
    const units = unitQueries[index]?.data;
    return { ...row, progress: units ? toPartProgress(units) : null };
  });

  /**
   * 받기 전에 누른 박스를 기다리게 하고, 받으면 이동한다. 받는 중인 요청이 있으면 같은 키라 그 요청에 합쳐진다.
   * 기다리는 동안 다른 박스는 누르지 않는다. 그 사이 화면을 떠났으면 이동하지 않는다.
   */
  async function waitThenOpen<T>(
    box: WaitingBox,
    fetch: () => Promise<T>,
    open: (data: T) => void,
  ) {
    if (waitingBox !== null) return;
    setWaitingBox(box);
    try {
      const data = await fetch();
      if (navigation.isFocused()) open(data);
    } catch {
      // 실패는 쿼리 상태로 그린다 — 파트 목록은 실패 화면, 이어서 하기는 카드 안 문구.
    } finally {
      setWaitingBox(null);
    }
  }

  function startPart(part: LearningPart) {
    const progress = rows.find((row) => row.part === part)?.progress;
    if (progress) {
      openNextLesson(part, progress.units);
      return;
    }
    void waitThenOpen(
      part,
      () => queryClient.fetchQuery(learningUnitsQueryOptions(part, level)),
      (fetched) => openNextLesson(part, fetched),
    );
  }

  function startResume() {
    if (resume) {
      openLesson(resume.part, resume.unitId, resume.lessonId);
      return;
    }
    void waitThenOpen(
      'resume',
      () => queryClient.fetchQuery(learningResumeQueryOptions(level)),
      (fetched) => openLesson(fetched.part, fetched.unitId, fetched.lessonId),
    );
  }

  function openNextLesson(part: LearningPart, units: LearningUnitSummary[]) {
    const pick = pickNextLesson(units);
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

        <ResumeCard
          color={card.color}
          content={
            resume
              ? { status: 'ready', resume }
              : isResumeFailed
                ? { status: 'failed' }
                : { status: 'loading' }
          }
          isWaiting={waitingBox === 'resume'}
          onPress={startResume}
        />

        <Text accessibilityRole="header" className="px-screen pb-element pt-card text-xl">
          다른 파트 고르기
        </Text>

        {failedQueries.length > 0 ? (
          <LearningLoadError onRetry={retryFailed} />
        ) : (
          <View className="gap-element px-lg">
            {rows.map((row) => (
              <Pressable
                key={row.part}
                accessibilityHint="아직 안 한 문항부터 시작합니다"
                accessibilityLabel={
                  row.progress
                    ? `Part ${row.part} ${row.name}. ${row.progress.totalCount}세트 중 ${row.progress.doneCount}세트 끝냄`
                    : `Part ${row.part} ${row.name}. 진행도를 불러오는 중`
                }
                accessibilityRole="button"
                className="flex-row items-center gap-md rounded-card bg-surface py-md pl-lg pr-md"
                disabled={row.progress?.totalCount === 0}
                onPress={() => startPart(row.part)}
              >
                <Feather name={row.icon} size={PART_ICON_SIZE} color={colors.ink.DEFAULT} />
                <View className="flex-1 gap-xs">
                  <Text className="text-lg">{row.name}</Text>
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    Part {row.part} · {row.sharedAcrossLevels ? '등급 공통' : row.description}
                  </Text>
                </View>
                {row.progress ? (
                  <Text className="text-sm text-ink-muted">
                    {row.progress.doneCount}/{row.progress.totalCount}
                  </Text>
                ) : null}
                <View className="h-12 w-12 items-center justify-center rounded-control bg-surface-muted">
                  {waitingBox === row.part ? (
                    <ActivityIndicator
                      accessibilityLabel="불러오는 중"
                      color={colors.ink.DEFAULT}
                    />
                  ) : (
                    <Feather name="play" size={size.icon.md} color={colors.ink.DEFAULT} />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** 받은 목록에서 파트 줄에 그릴 진행도. 줄을 누를 때 고를 문항도 이 목록에서 찾는다. */
interface PartProgress {
  units: LearningUnitSummary[];
  doneCount: number;
  totalCount: number;
}

function toPartProgress(units: LearningUnitSummary[]): PartProgress {
  const doneUnits = units.filter((unit) => unit.lessons.every((lesson) => lesson.completed));
  return { units, doneCount: doneUnits.length, totalCount: units.length };
}

/** 이어서 하기 카드 왼쪽에 그릴 내용. 응답을 받기 전과 못 받았을 때도 카드는 그린다. */
type ResumeCardContent =
  { status: 'ready'; resume: LearningResume } | { status: 'loading' } | { status: 'failed' };

interface ResumeCardProps {
  content: ResumeCardContent;
  /** 받기 전에 눌러 버튼에서 기다리는 중. */
  isWaiting: boolean;
  /** 등급 카드 색. 버튼 바탕에 쓴다. */
  color: string;
  onPress: () => void;
}

/**
 * 풍경 아래쪽에 걸친 이어서 하기 카드. 왼쪽은 위치, 오른쪽은 등급 색 버튼이다.
 *
 * 버튼은 등급 카드 CTA(`LearningLevelScreen`)처럼 직접 그린다. 공용 Button은 색을 variant로만 고르는데,
 * 등급 색을 variant로 올리면 공용 버튼이 학습 등급을 알게 된다(2026-10-27 리뷰 F1 뒤 결정).
 *
 * 위치를 받기 전에도 버튼은 누를 수 있다. 누르면 그 자리에서 받고 오면 이동한다. 못 받았을 때 누르면 다시 받는다.
 */
function ResumeCard({ content, isWaiting, color, onPress }: ResumeCardProps) {
  return (
    <View
      className="mx-lg flex-row items-center gap-md rounded-card bg-surface p-card"
      style={{ marginTop: -SCENE_HEIGHT * RESUME_CARD_OVERLAP_RATIO }}
    >
      <ResumeCardText content={content} />
      <Pressable
        accessibilityHint={resumeCardHint(content)}
        accessibilityRole="button"
        accessibilityState={{ busy: isWaiting }}
        className="min-h-control-lg flex-row items-center gap-xs rounded-control px-lg"
        disabled={isWaiting}
        style={{ backgroundColor: color }}
        onPress={onPress}
      >
        {isWaiting ? (
          <ActivityIndicator color={colors.ink.DEFAULT} />
        ) : (
          <Feather name="play" size={size.icon.md} color={colors.ink.DEFAULT} />
        )}
        <Text className="text-base">이어서 하기</Text>
      </Pressable>
    </View>
  );
}

function ResumeCardText({ content }: { content: ResumeCardContent }) {
  switch (content.status) {
    case 'ready': {
      const { resume } = content;
      return (
        <View className="flex-1 gap-xs">
          <Text className="text-xs text-ink-muted">{RESUME_LABELS[resume.status]}</Text>
          <Text className="text-lg" numberOfLines={1}>
            Part {resume.part} {resumePartName(resume)}
          </Text>
          <Text className="text-sm text-ink-muted">{resumePosition(resume)}</Text>
        </View>
      );
    }
    case 'loading':
      return (
        <View className="flex-1 gap-xs">
          <Text className="text-sm text-ink-muted">멈춘 곳을 찾고 있어요</Text>
        </View>
      );
    case 'failed':
      return (
        <View className="flex-1 gap-xs">
          <Text className="text-sm text-ink-muted">멈춘 곳을 불러오지 못했어요</Text>
          <Text className="text-xs text-ink-muted">버튼을 누르면 다시 불러와요</Text>
        </View>
      );
  }
}

function resumeCardHint(content: ResumeCardContent): string {
  switch (content.status) {
    case 'ready': {
      const { resume } = content;
      return `Part ${resume.part} ${resumePartName(resume)} ${resumePosition(resume)} 시작합니다`;
    }
    case 'loading':
      return '멈춘 곳을 불러온 뒤 시작합니다';
    case 'failed':
      return '멈춘 곳을 다시 불러온 뒤 시작합니다';
  }
}

function resumePartName(resume: LearningResume): string {
  return LEARNING_PART_ROWS.find((row) => row.part === resume.part)?.name ?? '';
}

function resumePosition(resume: LearningResume): string {
  return `${resume.unitNumber}세트 · ${resume.lessonNumber}번째 문항부터`;
}
