import { LearningRemoteImage } from '@/screens/learning/LearningRemoteImage';
import { useState } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LearningTable } from '@/screens/learning/LearningTable';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { LearningLesson } from '@/features/learning/learning-types';
import { layout, spacing } from '@/theme';
import { getLearningQuestionLayout } from '@/features/learning/learning-question-layout';

export function LearningSource({
  lesson,
  showPassage = false,
  onExpand,
  maxPhotoHeight,
}: {
  lesson: LearningLesson;
  showPassage?: boolean;
  onExpand?: () => void | Promise<boolean>;
  maxPhotoHeight?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { width } = useWindowDimensions();
  const [photoWidth, setPhotoWidth] = useState(0);
  if (lesson.part === 1)
    return showPassage ? <Text className="text-lg leading-8">{lesson.passage}</Text> : null;
  if (lesson.photo) {
    const ratio = lesson.photo.width / lesson.photo.height;
    const availableWidth = photoWidth || width - layout.screen * 2 - spacing.md * 2;
    const renderedWidth = Math.min(availableWidth, (maxPhotoHeight ?? Infinity) * ratio);
    return (
      <View
        className="w-full items-center"
        onLayout={(event) => setPhotoWidth(event.nativeEvent.layout.width)}
      >
        <LearningRemoteImage
          media={lesson.photo}
          accessibilityLabel="사진 묘사 문제"
          resizeMode="contain"
          className="rounded-control"
          style={{ width: renderedWidth, height: renderedWidth / ratio }}
        />
      </View>
    );
  }
  const questionLayout = getLearningQuestionLayout(lesson.question);
  const content = (
    <View className="gap-sm">
      {questionLayout ? (
        <View className="gap-sm">
          <Text className="text-base leading-6">{questionLayout.prompt}</Text>
          {questionLayout.choices.map((choice, index) => (
            <View key={choice} className="flex-row gap-sm">
              <Text className="text-sm leading-6 text-ink-muted">{index + 1}.</Text>
              <Text className="flex-1 text-base leading-6">{choice}</Text>
            </View>
          ))}
          {questionLayout.instruction ? (
            <Text className="text-sm leading-5 text-ink-muted">{questionLayout.instruction}</Text>
          ) : null}
        </View>
      ) : (
        <Text className={lesson.part === 4 ? 'text-sm leading-5' : 'text-base leading-6'}>
          {lesson.question}
        </Text>
      )}
      {lesson.table ? (
        <LearningTable table={lesson.tableFocus ?? lesson.table} compact condensed />
      ) : null}
    </View>
  );
  return (
    <View className="gap-sm">
      {lesson.table ? (
        <View className="flex-row items-center justify-between gap-sm pb-xs">
          <Text className="text-xs text-ink-muted">문제 자료</Text>
          <Button
            label="전체 표 보기"
            variant="text"
            size="sm"
            onPress={async () => {
              if ((await onExpand?.()) === false) return;
              setExpanded(true);
            }}
          />
        </View>
      ) : null}
      {content}
      <Modal
        visible={expanded}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView className="flex-1 bg-surface">
          <View className="border-b border-line p-screen">
            <Text className="mb-sm text-xs !text-brand-text">Q{lesson.questionNumber}</Text>
            <Text className={lesson.part === 4 ? 'text-sm leading-5' : 'text-base leading-6'}>
              {lesson.question}
            </Text>
          </View>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: layout.screen }}>
            {lesson.table ? <LearningTable table={lesson.table} /> : null}
          </ScrollView>
          <View className="p-screen">
            <Button label="닫기" onPress={() => setExpanded(false)} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
