import { Feather } from '@expo/vector-icons';
import { useNavigation, usePreventRemove, type NavigationAction } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  useTimedAudioRecorder,
  type AudioRecordingStatus,
} from '@/features/audio/use-timed-audio-recorder';
import type { LearningLevel } from '@/features/learning/learning-level';
import {
  useLearningGrading,
  type LearningGradingState,
} from '@/features/learning/use-learning-grading';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLessonFallback } from '@/screens/learning/components/LearningLessonFallback';
import { LearningPaperCard } from '@/screens/learning/components/LearningPaperCard';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import { useLearningLesson } from '@/screens/learning/use-learning-lesson';
import type { LearningGradeResult, LearningLesson, LearningVerdict } from '@/types/learning';
import { colors, shadows, size } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const waitingRabbit = require('../../../public/mascots/waiting_rabbit_tight.png');
const errorRabbit = require('../../../public/mascots/error.png');
const micRabbit = require('../../../public/mascots/mic_rabbit.png');

type LearningGradingScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningGrading'>;

/** 채점 녹음 최대 길이. 모범답안은 1분 안쪽이라 넉넉히 둔다. 96kbps면 약 1.4MB로 서버 한도(8MiB) 안이다. */
const ANSWER_MAX_MS = 120_000;
/** 채점 준비 안 됨에서 다시 시도 버튼이 눌리기까지. 바로 다시 눌러도 같은 답이라 잠깐 둔다. */
const RECHECK_DELAY_MS = 5_000;

const VERDICT_CHIPS = {
  met: {
    label: '지켰어요',
    surface: colors.challenge.mint.surface,
    text: colors.challenge.mint.text,
  },
  not_met: { label: '아쉬워요', surface: colors.brand[100], text: colors.brand.text },
  uncertain: { label: '잘 모르겠어요', surface: colors.surface.muted, text: colors.ink.muted },
} as const satisfies Record<LearningVerdict, { label: string; surface: string; text: string }>;

/**
 * 학습 ③ 실전처럼 답해 보기 + 채점 결과(시안 G2 토선생의 한마디).
 *
 * 쉐도잉은 보고 읽는 연습이라, 여기서는 한국어 뜻만 보고 처음부터 스스로 말한 녹음을 서버에 채점받는다
 * (2026-10-26 결정). 채점이 끝나면 서버가 이 문항을 완료로 남기고, 같은 세트에 다음 문항이 있으면 그 문항의
 * 퍼즐부터 다시 시작한다.
 */
export function LearningGradingScreen({ navigation, route }: LearningGradingScreenProps) {
  const lookup = useLearningLesson(route.params);
  const { level } = route.params;

  const closeToParts = () => navigation.popTo('LearningParts', { level });

  if (lookup.status !== 'found') {
    return <LearningLessonFallback lookup={lookup} onClose={closeToParts} />;
  }
  const { lesson, nextLesson } = lookup;

  function goNextLesson() {
    closeToParts();
    if (nextLesson) {
      navigation.navigate('LearningPuzzle', { ...route.params, lessonId: nextLesson.id });
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <LearningStepHeader onClose={closeToParts} title="토선생의 한마디" />
      <GradingLesson
        lesson={lesson}
        level={level}
        nextLabel={nextLesson ? `Q${nextLesson.questionNumber}로 넘어가기` : '세트 끝내기'}
        onNext={goNextLesson}
      />
    </SafeAreaView>
  );
}

interface GradingLessonProps {
  lesson: LearningLesson;
  level: LearningLevel;
  nextLabel: string;
  onNext: () => void;
}

/** 문항을 찾은 뒤의 녹음·채점. 녹음 파일은 다시 녹음하거나 화면을 나갈 때 녹음 훅이 지운다. */
function GradingLesson({ lesson, level, nextLabel, onNext }: GradingLessonProps) {
  const grading = useLearningGrading(lesson, level);
  const recorder = useTimedAudioRecorder<null>();
  const [recordFailed, setRecordFailed] = useState(false);
  /** 답하기를 눌러 녹음을 시작했고 아직 채점으로 넘기지 않았다. */
  const answeringRef = useRef(false);
  const { state } = grading;
  const { status: recorderStatus, remainingMs, finish: finishRecorder } = recorder;
  const { grade } = grading;
  const answerPhase = decideAnswerPhase(
    recorderStatus,
    recorder.canAskPermissionAgain,
    recordFailed,
  );

  async function startAnswer() {
    setRecordFailed(false);
    answeringRef.current = true;
    const result = await recorder.start({ context: null, maxDurationMs: ANSWER_MAX_MS });
    if (result.started) return;
    answeringRef.current = false;
    if (result.reason === 'error') setRecordFailed(true);
  }

  /** 녹음을 확정하고 채점으로 넘긴다. 사용자가 끝내도, 최대 길이에 닿아도 이 한 경로로 끝난다. */
  const finishAnswer = useCallback(async () => {
    if (!answeringRef.current) return;
    answeringRef.current = false;
    try {
      const answer = await finishRecorder('user');
      void grade(answer.audioFileUri);
    } catch {
      setRecordFailed(true);
    }
  }, [finishRecorder, grade]);

  /**
   * 최대 길이를 다 쓰면 네이티브가 먼저 멈추고 녹음 훅이 스스로 확정을 시작한다(`finalizing`). 그 신호나 남은
   * 시간 0을 보고 같은 종료 약속을 이어받는다 — 10초 챌린지와 같은 방식이다.
   */
  useEffect(() => {
    const hasRunOut = recorderStatus === 'recording' && remainingMs <= 0;
    if (!hasRunOut && recorderStatus !== 'finalizing') return;
    void finishAnswer();
  }, [finishAnswer, recorderStatus, remainingMs]);

  // 확정한 녹음 훅은 `finalizing`에 남는다. 다시 답할 수 있게 이전 녹음을 지우고 `idle`로 돌린다.
  function answerAgain() {
    recorder.resetForRetry();
    grading.reset();
    setRecordFailed(false);
  }

  function checkAgain() {
    recorder.resetForRetry();
    grading.recheck();
  }

  /**
   * 결과를 받기 전에 나가면 조회가 멈춰 파트 목록이 갱신되지 않고, 서버에 완료가 남아도 같은 문항으로 다시
   * 들어온다. 막지 않고 미리 알린다(2026-10-26 결정). X·스와이프·뒤로 가기를 모두 잡으려고 화면 제거를 가로챈다.
   */
  const navigation = useNavigation();
  const mayLoseResult =
    state.status === 'grading' || (state.status === 'failed' && state.stillGrading);
  const [blockedExit, setBlockedExit] = useState<NavigationAction | null>(null);
  const [confirmedExit, setConfirmedExit] = useState<NavigationAction | null>(null);
  usePreventRemove(mayLoseResult && confirmedExit === null, ({ data }) => {
    setBlockedExit(data.action);
  });
  // 팝업이 떠 있는 동안 결과가 나오면 가로챈 이동도 버린다. 남겨 두면 다음 채점 때 팝업이 저절로 다시 뜬다.
  useEffect(() => {
    if (!mayLoseResult) setBlockedExit(null);
  }, [mayLoseResult]);
  // 제거 방지를 끈 렌더 뒤에 이동한다. 같은 tick에 dispatch하면 아직 켜진 방지가 다시 가로챈다.
  useEffect(() => {
    if (confirmedExit) navigation.dispatch(confirmedExit);
  }, [confirmedExit, navigation]);

  return (
    <>
      <ScrollView contentContainerClassName="gap-section px-screen pb-section pt-sm">
        {state.status === 'completed' ? (
          <GradeResult result={state.result} />
        ) : (
          <>
            <GradingNotice answerPhase={answerPhase} state={state} />
            {state.status === 'ready' ? <AnswerPrompt lesson={lesson} /> : null}
          </>
        )}
      </ScrollView>

      <View className="gap-sm px-screen pb-lg">
        <GradingActions
          answerPhase={answerPhase}
          elapsedMs={recorder.elapsedMs}
          nextLabel={nextLabel}
          state={state}
          onAnswerAgain={answerAgain}
          onFinishAnswer={() => void finishAnswer()}
          onNext={onNext}
          onRecheck={checkAgain}
          onRetry={() => void grading.retry()}
          onStartAnswer={() => void startAnswer()}
        />
      </View>

      <ConfirmModal
        cancelLabel="결과 기다리기"
        confirmLabel="나가기"
        message="지금 나가면 채점 결과를 볼 수 없고, 다음에 같은 문제를 다시 풀게 될 수 있어요."
        title="채점이 아직 끝나지 않았어요"
        visible={blockedExit !== null && mayLoseResult}
        warningBadge
        onCancel={() => setBlockedExit(null)}
        onConfirm={() => setConfirmedExit(blockedExit)}
      />
    </>
  );
}

/** 질문과 모범답안의 한국어 뜻. 영어 문장은 보여 주지 않는다 — 뜻만 보고 스스로 말해 보는 단계다. */
function AnswerPrompt({ lesson }: { lesson: LearningLesson }) {
  const translations = lesson.sentences
    .map((sentence) => sentence.translation)
    .filter((translation): translation is string => translation !== null);

  return (
    <>
      <LearningPaperCard label={`Q${lesson.questionNumber} 질문`} tone="sky">
        <Text className="text-base leading-7">{lesson.question}</Text>
        {lesson.questionTranslation ? (
          <Text className="mt-sm text-sm text-ink-muted">{lesson.questionTranslation}</Text>
        ) : null}
      </LearningPaperCard>
      {translations.length > 0 ? (
        <LearningPaperCard hint="이 뜻을 영어로 처음부터 말해 봐요" label="한국어 뜻" tone="mint">
          <View className="gap-sm">
            {translations.map((translation, index) => (
              <Text key={`${index}-${translation}`} className="text-base leading-7">
                {translation}
              </Text>
            ))}
          </View>
        </LearningPaperCard>
      ) : null}
    </>
  );
}

/**
 * 답할 수 있는 상태(`ready`) 안의 녹음 단계. 안내와 버튼이 같은 값을 보게 녹음 훅 상태에서 한 번만 계산한다.
 * - `permission-blocked`: 다시 물을 수 없게 거부했다. 설정에서 켜야 한다.
 * - `record-failed`: 녹음 시작·확정이 실패했거나 앱이 뒤로 가 녹음 훅이 버렸다(`interrupted`).
 */
type AnswerPhase =
  'idle' | 'recording' | 'saving' | 'permission-denied' | 'permission-blocked' | 'record-failed';

function decideAnswerPhase(
  recorderStatus: AudioRecordingStatus,
  canAskPermissionAgain: boolean,
  recordFailed: boolean,
): AnswerPhase {
  switch (recorderStatus) {
    case 'preparing':
    case 'recording':
      return 'recording';
    case 'finalizing':
      return 'saving';
    case 'permission-denied':
      return canAskPermissionAgain ? 'permission-denied' : 'permission-blocked';
    case 'interrupted':
      return 'record-failed';
    case 'idle':
    case 'error':
      return recordFailed ? 'record-failed' : 'idle';
  }
}

interface GradingNoticeProps {
  state: LearningGradingState;
  answerPhase: AnswerPhase;
}

/** 기다리거나 실패했을 때의 마스코트 안내. 답할 수 있는 상태에서는 녹음 문제만 짧게 알린다. */
function GradingNotice({ state, answerPhase }: GradingNoticeProps): ReactElement | null {
  if (state.status === 'ready') {
    switch (answerPhase) {
      case 'permission-denied':
      case 'permission-blocked':
        return (
          <Text className="text-center text-sm text-exam-danger">
            답하려면 마이크 권한이 필요해요.
          </Text>
        );
      case 'record-failed':
        return (
          <Text className="text-center text-sm text-exam-danger">
            녹음이 멈췄어요. 다시 답해 주세요.
          </Text>
        );
      case 'idle':
      case 'recording':
      case 'saving':
        return null;
    }
  }

  const notice = getNotice(state);
  if (!notice) return null;
  return (
    <View className="items-center gap-sm py-lg">
      <Image
        accessibilityElementsHidden
        className="h-32 w-32"
        resizeMode="contain"
        source={notice.mascot}
      />
      <Text accessibilityRole="header" className="text-center text-xl text-brand-text">
        {notice.title}
      </Text>
      {notice.description ? (
        <Text className="text-center text-sm leading-6 text-ink-muted">{notice.description}</Text>
      ) : null}
    </View>
  );
}

interface GradingNoticeContent {
  mascot: ImageSourcePropType;
  title: string;
  description: string | null;
}

/** 마스코트 안내 문구. 답하는 중(`ready`)과 결과(`completed`)는 안내 대신 본문을 그린다. */
function getNotice(state: LearningGradingState): GradingNoticeContent | null {
  switch (state.status) {
    case 'ready':
    case 'completed':
      return null;
    case 'checking':
    case 'grading':
      return {
        mascot: waitingRabbit,
        title: state.status === 'grading' ? '채점이 진행중이에요' : '채점을 준비하고 있어요',
        description: state.status === 'grading' ? '잠시만 기다려 주세요.' : null,
      };
    case 'not-ready':
      return {
        mascot: errorRabbit,
        title: '서버가 현재 채점을 못해요',
        description: '잠시 후 다시 시도해주세요.',
      };
    case 'failed':
      return {
        mascot: errorRabbit,
        title: '채점하지 못했어요',
        description: state.canRetry
          ? '녹음은 그대로 있어요. 다시 시도해 주세요.'
          : '이 녹음으로는 채점할 수 없어요. 다시 답해 주세요.',
      };
    case 'no-speech':
      return {
        mascot: micRabbit,
        title: '목소리가 들리지 않았어요',
        description: '다시 답변해주세요.',
      };
  }
}

interface GradingActionsProps {
  state: LearningGradingState;
  answerPhase: AnswerPhase;
  elapsedMs: number;
  nextLabel: string;
  onStartAnswer: () => void;
  onFinishAnswer: () => void;
  onRetry: () => void;
  onRecheck: () => void;
  onAnswerAgain: () => void;
  onNext: () => void;
}

const PRIMARY_BUTTON =
  'min-h-control-lg flex-row items-center justify-center gap-sm rounded-control bg-brand-cta';
const SECONDARY_BUTTON =
  'min-h-control-lg flex-row items-center justify-center gap-sm rounded-control border border-line bg-surface';

function GradingActions({
  state,
  answerPhase,
  elapsedMs,
  nextLabel,
  onStartAnswer,
  onFinishAnswer,
  onRetry,
  onRecheck,
  onAnswerAgain,
  onNext,
}: GradingActionsProps): ReactElement | null {
  switch (state.status) {
    case 'checking':
    case 'grading':
      return null;
    case 'not-ready':
      return <RecheckButton onRecheck={onRecheck} />;
    case 'failed':
      return state.canRetry ? (
        <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={onRetry}>
          <Text className="text-lg text-surface">다시 시도하기</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={onAnswerAgain}>
          <Text className="text-lg text-surface">다시 녹음하기</Text>
        </Pressable>
      );
    case 'no-speech':
      return (
        <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={onAnswerAgain}>
          <Feather name="mic" size={size.icon.md} color={colors.surface.DEFAULT} />
          <Text className="text-lg text-surface">다시 녹음하러 가기</Text>
        </Pressable>
      );
    case 'completed':
      return (
        <>
          <Pressable
            accessibilityRole="button"
            className={SECONDARY_BUTTON}
            onPress={onAnswerAgain}
          >
            <Text className="text-base">다시 녹음</Text>
          </Pressable>
          <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={onNext}>
            <Text className="text-lg text-surface">{nextLabel}</Text>
          </Pressable>
        </>
      );
    case 'ready':
      return (
        <AnswerActions
          answerPhase={answerPhase}
          elapsedMs={elapsedMs}
          onFinishAnswer={onFinishAnswer}
          onStartAnswer={onStartAnswer}
        />
      );
  }
}

interface AnswerActionsProps {
  answerPhase: AnswerPhase;
  elapsedMs: number;
  onStartAnswer: () => void;
  onFinishAnswer: () => void;
}

/** 답할 수 있는 상태(`ready`)의 녹음 버튼. */
function AnswerActions({
  answerPhase,
  elapsedMs,
  onStartAnswer,
  onFinishAnswer,
}: AnswerActionsProps): ReactElement {
  switch (answerPhase) {
    case 'saving':
      return (
        <View className={PRIMARY_BUTTON}>
          <ActivityIndicator color={colors.surface.DEFAULT} />
        </View>
      );
    case 'recording':
      return (
        <Pressable accessibilityRole="button" className={SECONDARY_BUTTON} onPress={onFinishAnswer}>
          <Feather name="square" size={size.icon.md} color={colors.exam.danger} />
          <Text className="text-base">녹음 중 {formatElapsed(elapsedMs)} · 답 끝내기</Text>
        </Pressable>
      );
    // 다시 물을 수 없게 거부했으면 설정에서 켜야 한다(쉐도잉과 같은 처리).
    case 'permission-blocked':
      return (
        <Pressable
          accessibilityRole="button"
          className={SECONDARY_BUTTON}
          onPress={() => void Linking.openSettings().catch(() => undefined)}
        >
          <Feather name="settings" size={size.icon.md} color={colors.ink.DEFAULT} />
          <Text className="text-base">설정에서 마이크 켜기</Text>
        </Pressable>
      );
    case 'idle':
    case 'permission-denied':
    case 'record-failed':
      return (
        <Pressable accessibilityRole="button" className={PRIMARY_BUTTON} onPress={onStartAnswer}>
          <Feather name="mic" size={size.icon.md} color={colors.surface.DEFAULT} />
          <Text className="text-lg text-surface">답하고 채점받기</Text>
        </Pressable>
      );
  }
}

/** 준비 안 됨에서 다시 시도. 바로 누르지 못하게 몇 초 기다린다(2026-10-26 결정). */
function RecheckButton({ onRecheck }: { onRecheck: () => void }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), RECHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      className={PRIMARY_BUTTON}
      disabled={!enabled}
      style={enabled ? undefined : { opacity: 0.5 }}
      onPress={onRecheck}
    >
      <Text className="text-lg text-surface">
        {enabled ? '다시 시도하기' : '잠시 후 다시 시도할 수 있어요'}
      </Text>
    </Pressable>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1_000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function GradeResult({ result }: { result: LearningGradeResult }) {
  return (
    <>
      <View>
        <View
          className="rounded-card p-card"
          style={[shadows.card, { backgroundColor: colors.challenge.verdict }]}
        >
          <View className="items-center gap-sm rounded-2xl bg-surface p-lg">
            <Text className="text-center text-xl">
              {result.metCount}/{result.totalCount} 지켰어요!
            </Text>
            <Text className="text-xs text-ink-muted">
              답변 체크리스트예요. 공식 점수가 아니에요
            </Text>
          </View>
        </View>
        {/* 판정 카드 모서리의 별 스티커. */}
        <View className="absolute -left-2 -top-3" style={{ transform: [{ rotate: '-12deg' }] }}>
          <Feather name="star" size={size.icon.xl} color={colors.challenge.star} />
        </View>
      </View>

      <LearningPaperCard label="체크리스트" tone="sky">
        <View className="gap-md">
          {result.items.map((item) => {
            const chip = VERDICT_CHIPS[item.verdict];
            return (
              <View key={item.id} className="flex-row items-start gap-sm">
                <View
                  className="rounded-chip px-sm py-xs"
                  style={{ backgroundColor: chip.surface }}
                >
                  <Text className="text-xs" style={{ color: chip.text }}>
                    {chip.label}
                  </Text>
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="text-base">{item.label}</Text>
                  <Text className="text-xs text-ink-muted">{item.feedback}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </LearningPaperCard>

      <LearningPaperCard label="내 답변" tone="mint">
        <Text className="text-base leading-7">{result.transcript}</Text>
      </LearningPaperCard>
    </>
  );
}
