import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { getLearningStageLabel } from '@/features/learning/learning-progress';
import type { LearningLesson, LearningStage } from '@/features/learning/learning-types';
import { LearningSource } from '@/screens/learning/LearningSource';
import { spacing } from '@/theme';
import { LearningTranslationSheet } from '@/screens/learning/LearningTranslationSheet';

export function LearningFrame({
  lesson,
  label,
  children,
  stage,
  progress,
  round,
  timer,
  onSourceOpen,
  actions,
  highlighted = false,
  feedback,
  translation,
}: {
  lesson: LearningLesson;
  label: string;
  children: ReactNode;
  stage: LearningStage;
  progress?: { current: number; total: number };
  round?: number;
  timer?: number | string;
  onSourceOpen?: () => void | Promise<boolean>;
  actions?: ReactNode;
  highlighted?: boolean;
  feedback?: ReactNode;
  translation?: { text?: string; english: string; key: string };
}) {
  const [meaningVisible, setMeaningVisible] = useState(false);
  const questionMeaning =
    lesson.part !== 1 && !lesson.photo && lesson.questionTranslation
      ? { english: lesson.question, korean: lesson.questionTranslation }
      : undefined;
  const sentenceMeaning =
    lesson.part !== 1 && translation?.text
      ? { english: translation.english, korean: translation.text }
      : undefined;
  const hasMeaning = Boolean(questionMeaning || sentenceMeaning);
  useEffect(() => setMeaningVisible(false), [lesson.id, stage, translation?.key]);
  const { height } = useWindowDimensions();
  const practice = stage === 'practice';
  const scroll = useRef<ScrollView>(null);
  const [sourceVisible, setSourceVisible] = useState(true);
  const [paneHeight, setPaneHeight] = useState(0);
  const [sentenceHeight, setSentenceHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [offset, setOffset] = useState(0);
  const hasSource = lesson.part !== 1 || practice;
  const moreBelow = paneHeight > 0 && contentHeight - paneHeight - offset > spacing.lg;
  // Fit the photo around the measured sentence, without distorting it or shrinking words.
  // Very long text keeps one scroll surface; the photo never becomes a tiny thumbnail.
  const maxPhotoHeight = Math.min(
    height * (practice ? 0.36 : 0.25),
    Math.max(height * 0.14, paneHeight - sentenceHeight - spacing.md * 5),
  );
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    setOffset(0);
  }, [lesson.id, stage]);
  return (
    <View className="min-h-0 flex-1 px-screen pb-sm">
      <View className="min-h-11 flex-row items-center justify-between gap-sm">
        <Text className="text-xs text-ink-muted">
          Q{lesson.questionNumber} · {getLearningStageLabel(stage, lesson.part)}
        </Text>
        <View className="flex-row items-center gap-xs">
          {practice ? (
            <Text className="text-sm font-semibold">
              {typeof timer === 'string' ? timer : `${timer ?? lesson.answerSeconds}초`}
            </Text>
          ) : null}
          {lesson.part !== 1 ? (
            <Button
              label={sourceVisible ? '문제 접기' : '문제 보기'}
              variant="text"
              size="sm"
              onPress={() => {
                setSourceVisible((visible) => !visible);
                scroll.current?.scrollTo({ y: 0, animated: false });
                setOffset(0);
              }}
              renderIcon={({ size, color }) => (
                <Feather
                  name={sourceVisible ? 'chevron-up' : 'chevron-down'}
                  size={size}
                  color={color}
                />
              )}
            />
          ) : null}
        </View>
      </View>
      <View className="min-h-0 flex-1 overflow-hidden rounded-card">
        <ScrollView
          ref={scroll}
          className="flex-1"
          bounces={false}
          showsVerticalScrollIndicator
          scrollEventThrottle={32}
          onLayout={(event) => setPaneHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_width, nextHeight) => {
            setContentHeight(nextHeight);
            // Once the learner scrolls to the sentence, a new round must not hide it again.
            if (offset > spacing.md) scroll.current?.scrollToEnd({ animated: false });
          }}
          onScroll={(event) => setOffset(event.nativeEvent.contentOffset.y)}
          contentContainerStyle={{ flexGrow: 1, gap: spacing.md, paddingBottom: spacing.sm }}
        >
          {hasSource && sourceVisible ? (
            <View className="shrink-0 rounded-control border border-line bg-surface p-md">
              <LearningSource
                lesson={lesson}
                showPassage={practice}
                onExpand={onSourceOpen}
                maxPhotoHeight={maxPhotoHeight}
              />
            </View>
          ) : null}
          {!practice ? (
            <View
              className={`shrink-0 gap-md rounded-card border bg-surface p-card ${highlighted ? 'border-brand-300' : 'border-learning-paperLine'}`}
              onLayout={(event) => setSentenceHeight(event.nativeEvent.layout.height)}
            >
              <View className="flex-row flex-wrap items-center justify-between gap-sm">
                <Text className="text-xs font-semibold !text-brand-text">
                  {label}
                  {round !== undefined ? ` · 연습 ${round + 1}/3` : ''}
                </Text>
                {progress ? (
                  <Text className="text-xs text-ink-muted">
                    문장 {progress.current}/{progress.total}
                  </Text>
                ) : null}
              </View>
              {children}
            </View>
          ) : (
            <View
              className="shrink-0"
              onLayout={(event) => setSentenceHeight(event.nativeEvent.layout.height)}
            >
              {children}
            </View>
          )}
        </ScrollView>
        {moreBelow && !feedback ? (
          <View className="absolute bottom-xs right-xs rounded-control bg-surface">
            <Button
              label="아래 내용 보기"
              variant="neutral"
              size="sm"
              renderIcon={({ size, color }) => (
                <Feather name="chevron-down" size={size} color={color} />
              )}
              onPress={() =>
                scroll.current?.scrollTo({ y: offset + paneHeight * 0.7, animated: true })
              }
            />
          </View>
        ) : null}
        {feedback}
      </View>
      {actions || hasMeaning ? (
        <View
          className={
            actions
              ? 'mt-sm min-h-11 flex-row flex-wrap items-center justify-between rounded-control border border-learning-paperLine bg-surface px-sm'
              : 'mt-sm min-h-11 flex-row items-center justify-end'
          }
        >
          {actions}
          {hasMeaning ? (
            <Button
              label="해석 보기"
              variant="text"
              size="sm"
              className={actions ? undefined : 'ml-auto'}
              renderIcon={({ size, color }) => (
                <Feather name="book-open" size={size} color={color} />
              )}
              onPress={async () => {
                if ((await onSourceOpen?.()) === false) return;
                setMeaningVisible(true);
              }}
            />
          ) : null}
        </View>
      ) : null}
      {hasMeaning ? (
        <LearningTranslationSheet
          visible={meaningVisible}
          onClose={() => setMeaningVisible(false)}
          question={questionMeaning}
          sentence={sentenceMeaning}
        />
      ) : null}
    </View>
  );
}
