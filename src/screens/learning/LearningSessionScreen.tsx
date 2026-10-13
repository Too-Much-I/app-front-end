import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { learningUnitQuery, LEARNING_QUERY_KEY } from '@/features/learning/learning-queries';
import { putLearningCompletion } from '@/features/learning/api/put-learning-completion';
import { Feather } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  EMPTY_LEARNING_PROGRESS,
  getLearningReviewPosition,
  getLearningStageCompletion,
  getLearningStageLabel,
  type LearningProgress,
  type LearningTake,
} from '@/features/learning/learning-progress';
import type {
  LearningAnswer,
  LearningLesson,
  LearningLevel,
  LearningStage,
  LearningUnit,
  LearningUnitDetail,
} from '@/features/learning/learning-types';
import type { LearningStackParamList } from '@/navigation/types';
import { LearningListen } from '@/screens/learning/LearningListen';
import { LearningPractice } from '@/screens/learning/LearningPractice';
import { LearningReadingComparison } from '@/screens/learning/LearningReadingComparison';
import { LearningShadow } from '@/screens/learning/LearningShadow';
import { LearningCheckResultCard } from '@/screens/learning/LearningCheckResultCard';
import type { LearningCheckResult } from '@/features/learning/learning-submission';
import { useLearningSubmission } from '@/features/learning/use-learning-submission';
import { useLearningGradingSupport } from '@/features/learning/use-learning-grading-support';
import { colors } from '@/theme';

type SessionProps = NativeStackScreenProps<LearningStackParamList, 'LearningSession'>;
const STAGES = ['listen', 'shadow', 'practice'] as const;
export function LearningSessionScreen({ navigation, route }: SessionProps) {
  const query = useQuery(learningUnitQuery(route.params.unitId, route.params.level));
  // Wait for this visit's first fetch, then keep an active exercise mounted during cache refreshes.
  if (query.isPending || (!query.isFetchedAfterMount && query.isFetching))
    return (
      <SafeAreaView className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  if (!query.data)
    return (
      <SafeAreaView className="flex-1 justify-center gap-element px-screen">
        <Text>학습 데이터를 불러오지 못했어요.</Text>
        <Button label="다시 불러오기" onPress={() => void query.refetch()} />
        <Button label="학습 홈으로 돌아가기" onPress={() => navigation.popToTop()} />
      </SafeAreaView>
    );
  return (
    <LearningUnitSession
      key={`${route.params.unitId}:${route.params.level}`}
      navigation={navigation}
      route={route}
      content={query.data}
    />
  );
}
function LearningUnitSession({
  navigation,
  route,
  content,
}: SessionProps & { content: LearningUnitDetail }) {
  // Text, audio timings and contentVersion are one snapshot for the whole visit, including Q5–7/Q8–10.
  const [snapshot] = useState(content);
  const [question, setQuestion] = useState(route.params.questionIndex ?? 0);
  const [hasChangedQuestion, setHasChangedQuestion] = useState(false);
  const unit = snapshot.unit;
  const lesson = snapshot.lessons[question];
  const answer = lesson?.answers[lesson.part === 1 ? 'common' : route.params.level];
  if (!lesson || !answer)
    return (
      <SafeAreaView className="flex-1 justify-center gap-element px-screen">
        <Text>학습 문항을 확인하지 못했어요.</Text>
        <Button label="학습 홈으로 돌아가기" onPress={() => navigation.popToTop()} />
      </SafeAreaView>
    );
  return (
    <LearningLessonSession
      key={`${lesson.id}:${route.params.level}`}
      navigation={navigation}
      unit={unit}
      lesson={lesson}
      answer={answer}
      level={route.params.level}
      question={question}
      onQuestion={(index) => {
        setHasChangedQuestion(true);
        setQuestion(index);
      }}
      initialStage={
        !hasChangedQuestion && question === (route.params.questionIndex ?? 0)
          ? route.params.initialStage
          : undefined
      }
    />
  );
}
function LearningLessonSession({
  navigation,
  unit,
  lesson,
  answer,
  level,
  question,
  onQuestion,
  initialStage,
}: {
  navigation: SessionProps['navigation'];
  unit: LearningUnit;
  lesson: LearningLesson;
  answer: LearningAnswer;
  level: LearningLevel;
  question: number;
  onQuestion: (index: number) => void;
  initialStage?: LearningStage;
}) {
  const [progress, setProgress] = useState(EMPTY_LEARNING_PROGRESS);
  const update = useCallback((patch: Partial<LearningProgress>) => {
    setProgress((current) => ({ ...current, ...patch }));
  }, []);
  const queryClient = useQueryClient();
  const completionSave = useMutation({
    mutationFn: putLearningCompletion,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...LEARNING_QUERY_KEY, 'units'] });
    },
  });
  const [completedSubmissionId, setCompletedSubmissionId] = useState<string>();
  const [stage, setStage] = useState<LearningStage>(initialStage ?? 'listen');
  const sessionFiles = useRef(new Set<string>());
  useEffect(() => {
    const files = sessionFiles.current;
    return () => {
      for (const uri of files) {
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch {
          /* Temporary recordings can also be evicted by the OS. */
        }
      }
    };
  }, []);
  const [done, setDone] = useState(false);
  const [checkResult, setCheckResult] = useState<LearningCheckResult | null>(null);
  const gradingSupport = useLearningGradingSupport(lesson.id, lesson.part !== 1);
  const submission = useLearningSubmission(
    lesson.id,
    level,
    progress.take,
    (result, submissionId) => {
      setCompletedSubmissionId(submissionId);
      setCheckResult(result);
      update({ practiced: true });
      setDone(true);
    },
    lesson.contentVersion,
  );
  const [moving, setMoving] = useState(false);
  const switching = useRef(false);
  const leave = useRef<() => Promise<boolean>>(async () => true);
  const registerLeave = useCallback((handler: () => Promise<boolean>) => {
    leave.current = handler;
    return () => {
      if (leave.current === handler) leave.current = async () => true;
    };
  }, []);
  const change = useCallback(async (action: () => void) => {
    if (switching.current) return;
    switching.current = true;
    setMoving(true);
    try {
      if (await leave.current()) action();
    } catch {
      /* The stage keeps its own native error visible and remains mounted. */
    } finally {
      switching.current = false;
      setMoving(false);
    }
  }, []);
  usePreventRemove(true, ({ data }) => {
    void change(() => navigation.dispatch(data.action));
  });
  const selectStage = (next: LearningStage, review = false) =>
    void change(() => {
      update({
        stage: next,
        ...(review
          ? getLearningReviewPosition(progress, answer.sentences.length, lesson.part, next)
          : {}),
      });
      setStage(next);
      setDone(false);
    });
  const saveListen = useCallback(
    (listen: LearningProgress['listen']) => update({ listen }),
    [update],
  );
  const saveShadow = useCallback(
    (shadow: LearningProgress['shadow']) => update({ shadow }),
    [update],
  );
  const saveTake = useCallback(
    (take: LearningTake | null) => {
      if (take) sessionFiles.current.add(take.uri);
      update({ take, practiced: false });
    },
    [update],
  );
  const completion = getLearningStageCompletion(progress, answer.sentences.length, lesson.part);
  const { mutate: saveCompletion } = completionSave;
  const completionInput = {
    lessonId: lesson.id,
    contentVersion: lesson.contentVersion,
    level: lesson.part === 1 ? ('common' as const) : level,
    submissionId: completedSubmissionId,
  };
  useEffect(() => {
    if (progress.practiced)
      saveCompletion({
        lessonId: lesson.id,
        contentVersion: lesson.contentVersion,
        level: lesson.part === 1 ? 'common' : level,
        submissionId: completedSubmissionId,
      });
  }, [
    progress.practiced,
    saveCompletion,
    lesson.id,
    lesson.contentVersion,
    lesson.part,
    level,
    completedSubmissionId,
  ]);
  return (
    <SafeAreaView className="flex-1 bg-surface-subtle">
      <View className="h-14 flex-row items-center gap-element px-screen">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="학습 홈으로 돌아가기"
          disabled={moving || submission.busy}
          className="h-11 w-11 items-center justify-center"
          onPress={() => navigation.popToTop()}
        >
          <Feather name="x" size={22} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="flex-1 text-lg font-semibold" numberOfLines={1}>
          {unit.title}
        </Text>
        {unit.lessonIds.length > 1 ? (
          <View className="flex-row gap-xs">
            {unit.lessonIds.map((id, index) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Q${unit.questionNumbers[index]} 문항 선택`}
                accessibilityState={{ selected: question === index }}
                disabled={moving || submission.busy}
                onPress={() => void change(() => onQuestion(index))}
                className={`h-11 min-w-11 items-center justify-center rounded-control px-sm ${question === index ? 'bg-brand-100' : ''}`}
              >
                <Text
                  className={`text-sm ${question === index ? '!text-brand-text' : 'text-ink-muted'}`}
                >
                  Q{unit.questionNumbers[index]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {completionSave.isError ? (
        <View className="flex-row items-center gap-sm px-screen">
          <Text className="flex-1 text-xs text-ink-muted">완료 기록을 저장하지 못했어요.</Text>
          <Button
            label="다시 저장"
            size="sm"
            variant="text"
            onPress={() => saveCompletion(completionInput)}
          />
        </View>
      ) : null}
      {done && checkResult ? (
        <View className="min-h-0 flex-1">
          <ScrollView
            className="min-h-0 flex-1"
            contentContainerClassName="gap-lg px-screen pb-xl pt-md"
            showsVerticalScrollIndicator
          >
            <LearningCheckResultCard result={checkResult} />
          </ScrollView>
          <View className="gap-xs border-t border-learning-paperLine bg-surface-subtle px-screen pb-sm pt-md">
            <Button label="학습 홈으로 돌아가기" size="lg" onPress={() => navigation.popToTop()} />
            <Button
              label="다시 녹음하기"
              variant="text"
              onPress={() => {
                setCheckResult(null);
                saveTake(null);
                selectStage('practice');
              }}
            />
          </View>
        </View>
      ) : done ? (
        <LearningReadingComparison
          answer={answer}
          take={progress.take}
          registerLeave={registerLeave}
          onHome={() => navigation.popToTop()}
          onRetake={() =>
            void change(() => {
              saveTake(null);
              setStage('practice');
              setDone(false);
            })
          }
        />
      ) : (
        <>
          <View accessibilityRole="tablist" className="flex-row gap-sm px-screen">
            {STAGES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: stage === value }}
                disabled={moving || submission.busy}
                onPress={() => selectStage(value)}
                className={`h-11 flex-1 items-center justify-center border-b-2 ${stage === value ? 'border-brand' : 'border-transparent'}`}
              >
                <Text
                  className={`text-xs font-semibold ${stage === value ? '!text-brand-text' : 'text-ink-muted'}`}
                >
                  {getLearningStageLabel(value, lesson.part)}
                  {completion[value] ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {stage === 'listen' ? (
            <LearningListen
              lesson={lesson}
              answer={answer}
              initial={progress.listen}
              onProgress={saveListen}
              registerLeave={registerLeave}
              onNext={() => selectStage('shadow')}
            />
          ) : stage === 'shadow' ? (
            <LearningShadow
              lesson={lesson}
              answer={answer}
              initial={progress.shadow}
              onProgress={saveShadow}
              registerLeave={registerLeave}
              onNext={() => selectStage('practice')}
            />
          ) : (
            <LearningPractice
              lesson={lesson}
              take={progress.take}
              onTake={saveTake}
              registerLeave={registerLeave}
              submission={submission}
              gradingSupport={gradingSupport}
              onComplete={() => {
                update({ practiced: true });
                setDone(true);
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
