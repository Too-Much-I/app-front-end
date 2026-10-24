import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotModal } from '@/components/ui/MascotModal';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { useReadingCompletion } from '@/features/learning/use-reading-completion';
import type { RootStackParamList } from '@/navigation/types';
import { LearningLessonFallback } from '@/screens/learning/components/LearningLessonFallback';
import { LearningPaperCard } from '@/screens/learning/components/LearningPaperCard';
import { LearningStepHeader } from '@/screens/learning/components/LearningStepHeader';
import { useLearningLesson } from '@/screens/learning/use-learning-lesson';
import { useShadowingTake, type ShadowingPhase } from '@/screens/learning/use-shadowing-take';
import type { LearningSentence } from '@/types/learning';
import { colors, size } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const micRabbit = require('../../../public/mascots/mic_rabbit.png');

type LearningShadowingScreenProps = NativeStackScreenProps<RootStackParamList, 'LearningShadowing'>;

/** 들어올 때 잠깐 띄우는 이어폰 안내. 이어폰 연결 확인은 다음 작업 단위(2026-10-23 결정). */
const SPEAKER_NOTICE_MS = 3_000;

/**
 * 학습 ② 듣기·따라 말하기(시안 S2 문장 카드).
 *
 * 문장을 하나씩, 모범 음성을 틀어 놓고 칠해지는 단어를 보며 동시에 따라 말한다. 따라 말하는 동안 녹음해서
 * 끝나면 내 녹음을 다시 들을 수 있다. 녹음은 서버로 보내지 않고, 다음 문장으로 가거나 화면을 나가면 지운다.
 *
 * Part 1은 채점이 없어 여기서 끝나고 서버에 완료를 저장한다. Part 2~5는 ③ 채점으로 넘어간다.
 */
export function LearningShadowingScreen({ navigation, route }: LearningShadowingScreenProps) {
  const lookup = useLearningLesson(route.params);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [speakerNoticeVisible, setSpeakerNoticeVisible] = useState(true);
  const completion = useReadingCompletion();

  useEffect(() => {
    const timer = setTimeout(() => setSpeakerNoticeVisible(false), SPEAKER_NOTICE_MS);
    return () => clearTimeout(timer);
  }, []);

  function closeToParts() {
    navigation.popTo('LearningParts', { level: route.params.level });
  }

  if (lookup.status !== 'found') {
    return <LearningLessonFallback lookup={lookup} onClose={closeToParts} />;
  }
  const { lesson } = lookup;
  const sentence = lesson.sentences[sentenceIndex];
  if (!sentence) {
    return <LearningLessonFallback lookup={{ status: 'missing' }} onClose={closeToParts} />;
  }

  const isLastSentence = sentenceIndex === lesson.sentences.length - 1;
  const isReadingPart = route.params.part === 1;

  function goNext() {
    if (!isLastSentence) {
      setSentenceIndex((index) => index + 1);
      return;
    }
    if (isReadingPart) {
      // Part 1 완료는 제출 없이 저장한다(Swagger: `common`, submissionId 생략).
      completion.mutate(lesson, { onSuccess: closeToParts });
      return;
    }
    navigation.navigate('LearningGrading', route.params);
  }

  const nextLabel = !isLastSentence
    ? '다음 문장'
    : isReadingPart
      ? '연습 끝내기'
      : '다음: 실전처럼 답해 보기';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <LearningStepHeader
        onClose={closeToParts}
        progress={{ current: sentenceIndex, total: lesson.sentences.length }}
        title="듣고 따라 말하기"
      />

      {/* 문장이 바뀌면 플레이어·녹음기를 새로 만든다. 이전 문장의 녹음 파일은 이때 지워진다. */}
      <ShadowingSentence
        key={sentenceIndex}
        doneSentences={lesson.sentences.slice(0, sentenceIndex)}
        sentence={sentence}
        footer={
          <>
            {completion.isError ? (
              <Text className="text-center text-sm text-exam-danger">
                완료를 저장하지 못했어요. 다시 눌러 주세요.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              className="min-h-control-lg items-center justify-center rounded-control bg-brand-cta"
              disabled={completion.isPending}
              onPress={goNext}
            >
              {completion.isPending ? (
                <ActivityIndicator color={colors.surface.DEFAULT} />
              ) : (
                <Text className="text-lg text-surface">{nextLabel}</Text>
              )}
            </Pressable>
          </>
        }
      />

      <MascotModal
        message="스피커로 들으면서 따라 말하면 모범 음성이 같이 녹음될 수 있어요. 이어폰을 끼면 내 목소리만 들려요."
        mascot={micRabbit}
        onRequestClose={() => setSpeakerNoticeVisible(false)}
        title="이어폰을 끼면 더 좋아요"
        visible={speakerNoticeVisible}
        warningBadge
      >
        <Pressable
          accessibilityRole="button"
          className="mt-lg min-h-control-lg items-center justify-center self-stretch rounded-control bg-brand-cta"
          onPress={() => setSpeakerNoticeVisible(false)}
        >
          <Text className="text-lg text-surface">알겠어요</Text>
        </Pressable>
      </MascotModal>
    </SafeAreaView>
  );
}

interface ShadowingSentenceProps {
  sentence: LearningSentence;
  doneSentences: readonly LearningSentence[];
  /** 다음 문장·연습 끝내기 버튼. 문장마다 바뀌지 않아 화면이 넘겨준다. */
  footer: ReactNode;
}

function ShadowingSentence({ sentence, doneSentences, footer }: ShadowingSentenceProps) {
  const take = useShadowingTake(sentence);
  const { phase, spokenCount } = take;
  const spoken = sentence.words
    .slice(0, spokenCount)
    .map((word) => word.text)
    .join(' ');
  const rest = sentence.words
    .slice(spokenCount)
    .map((word) => word.text)
    .join(' ');
  const busy = phase === 'preparing' || phase === 'saving';

  return (
    <>
      <ScrollView contentContainerClassName="gap-section px-screen pb-section">
        <View className="flex-row items-center gap-md">
          <Image
            accessibilityLabel="마이크를 든 토끼"
            className="h-16 w-16"
            resizeMode="contain"
            source={micRabbit}
          />
          <Text className="flex-1 text-base">
            모범 음성을 들으며 칠해지는 단어를 따라 동시에 말해 봐요
          </Text>
        </View>

        {doneSentences.map((done, index) => (
          <View
            key={`${index}-${done.text}`}
            className="flex-row items-center gap-sm rounded-control bg-surface px-lg py-md"
          >
            <Feather name="check" size={size.icon.sm} color={colors.challenge.mint.text} />
            <Text className="flex-1 text-sm text-ink-muted">{done.text}</Text>
          </View>
        ))}

        <LearningPaperCard
          hint="파란 단어가 지금 나오는 소리예요"
          label="따라 말할 문장"
          tone="sky"
        >
          <View className="gap-sm">
            <Text className="text-xl leading-8">
              <Text className="text-xl leading-8" style={{ color: colors.sky.text }}>
                {spoken}
              </Text>
              {spoken && rest ? ' ' : ''}
              {rest}
            </Text>
            {sentence.translation ? (
              <Text className="text-sm text-ink-muted">{sentence.translation}</Text>
            ) : null}
            <Pressable
              accessibilityLabel={phase === 'listening' ? '듣기 멈추기' : '녹음 없이 듣기'}
              accessibilityRole="button"
              className="mt-xs h-11 w-11 items-center justify-center self-start rounded-full"
              disabled={busy || phase === 'shadowing'}
              style={{ backgroundColor: colors.sky.surface }}
              onPress={phase === 'listening' ? take.stop : () => void take.listen()}
            >
              <Feather
                name={phase === 'listening' ? 'pause' : 'volume-2'}
                size={size.icon.md}
                color={colors.sky.text}
              />
            </Pressable>
          </View>
        </LearningPaperCard>

        <ShadowingNotice phase={phase} />
      </ScrollView>

      <View className="gap-sm px-screen pb-lg">
        <ShadowingActions
          busy={busy}
          canAskPermissionAgain={take.canAskPermissionAgain}
          hasRecording={take.hasRecording}
          phase={phase}
          onPlayMine={take.playMine}
          onShadow={() => void take.shadow()}
          onStop={take.stop}
        />
        {footer}
      </View>
    </>
  );
}

function ShadowingNotice({ phase }: { phase: ShadowingPhase }) {
  if (phase === 'permission-denied') {
    return (
      <Text className="text-center text-sm text-exam-danger">
        따라 말하려면 마이크 권한이 필요해요.
      </Text>
    );
  }
  if (phase === 'failed') {
    return (
      <Text className="text-center text-sm text-exam-danger">
        소리를 준비하지 못했어요. 다시 눌러 주세요.
      </Text>
    );
  }
  return null;
}

interface ShadowingActionsProps {
  phase: ShadowingPhase;
  busy: boolean;
  hasRecording: boolean;
  canAskPermissionAgain: boolean;
  onShadow: () => void;
  onStop: () => void;
  onPlayMine: () => void;
}

const SECONDARY_BUTTON =
  'min-h-control-lg flex-1 flex-row items-center justify-center gap-sm rounded-control border border-line bg-surface';

/** 따라 말하기 버튼 줄. 녹음이 있으면 다시 듣기와 다시 따라 말하기를 나란히 둔다. */
function ShadowingActions({
  phase,
  busy,
  hasRecording,
  canAskPermissionAgain,
  onShadow,
  onStop,
  onPlayMine,
}: ShadowingActionsProps) {
  if (busy) {
    return (
      <View className={SECONDARY_BUTTON}>
        <ActivityIndicator color={colors.ink.DEFAULT} />
      </View>
    );
  }

  if (phase === 'shadowing') {
    return (
      <Pressable accessibilityRole="button" className={SECONDARY_BUTTON} onPress={onStop}>
        <Feather name="square" size={size.icon.md} color={colors.exam.danger} />
        <Text className="text-base">녹음 중 · 멈추기</Text>
      </Pressable>
    );
  }

  // 다시 물을 수 없게 거부했으면 설정에서 켜야 한다. 그 전까지 따라 말하기는 멈춘다(2026-10-23 결정).
  if (phase === 'permission-denied' && !canAskPermissionAgain) {
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
  }

  const shadowButton = (
    <Pressable accessibilityRole="button" className={SECONDARY_BUTTON} onPress={onShadow}>
      <Feather name="mic" size={size.icon.md} color={colors.ink.DEFAULT} />
      <Text className="text-base">{hasRecording ? '다시 따라 말하기' : '따라 말하기'}</Text>
    </Pressable>
  );

  if (!hasRecording) return shadowButton;

  const playingMine = phase === 'playing-mine';
  return (
    <View className="flex-row gap-sm">
      <Pressable
        accessibilityRole="button"
        className={SECONDARY_BUTTON}
        onPress={playingMine ? onStop : onPlayMine}
      >
        <Feather
          name={playingMine ? 'pause' : 'play'}
          size={size.icon.md}
          color={colors.ink.DEFAULT}
        />
        <Text className="text-base">{playingMine ? '멈추기' : '내 녹음 듣기'}</Text>
      </Pressable>
      {shadowButton}
    </View>
  );
}
