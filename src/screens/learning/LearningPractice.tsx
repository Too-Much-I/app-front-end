import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useTimedAudioRecorder } from '@/features/audio/use-timed-audio-recorder';
import {
  formatLearningTime,
  getLearningTakeIssue,
  isLearningTakeUsable,
  type LearningTake,
} from '@/features/learning/learning-progress';
import type { LearningLesson } from '@/features/learning/learning-types';
import { useLearningAudio } from '@/features/learning/use-learning-audio';
import { preserveLearningRecording } from '@/features/learning/learning-recording-file';
import type { useLearningSubmission } from '@/features/learning/use-learning-submission';
import type { useLearningGradingSupport } from '@/features/learning/use-learning-grading-support';
import { colors } from '@/theme';
import { LearningControls } from '@/screens/learning/LearningControls';
import { LearningFrame } from '@/screens/learning/LearningFrame';
import {
  LearningAnswerCard,
  type LearningAnswerCardState,
} from '@/screens/learning/LearningAnswerCard';

export function LearningPractice({
  lesson,
  take,
  onTake,
  onComplete,
  registerLeave,
  submission,
  gradingSupport,
}: {
  lesson: LearningLesson;
  take: LearningTake | null;
  onTake: (take: LearningTake | null) => void;
  onComplete: () => void;
  registerLeave: (leave: () => Promise<boolean>) => () => void;
  submission: ReturnType<typeof useLearningSubmission>;
  gradingSupport: ReturnType<typeof useLearningGradingSupport>;
}) {
  const recorder = useTimedAudioRecorder<string>();
  const audio = useLearningAudio();
  const [message, setMessage] = useState(
    take ? '녹음한 내 답변을 확인해 보세요.' : '마이크를 누르고 답변해 보세요.',
  );
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const startedAt = useRef(0);
  const finalizedSeconds = useRef<number | null>(null);
  const recordingActive = useRef(false);
  const soundSamples = useRef({ available: false, audible: 0 });
  const saveTask = useRef<Promise<boolean> | null>(null);
  const startTask = useRef<Promise<void> | null>(null);
  const current = useRef({ recorder, take, onTake });
  current.current = { recorder, take, onTake };
  useEffect(() => {
    if (take && !new File(take.uri).exists) {
      onTake(null);
      setMessage('저장한 녹음 파일을 찾지 못했어요. 다시 녹음해 주세요.');
    }
  }, [take, onTake]);
  useEffect(() => {
    if (recorder.status !== 'recording' || recorder.meteringDb === null) return;
    soundSamples.current.available = true;
    if (recorder.meteringDb > -45) soundSamples.current.audible++;
  }, [recorder.elapsedMs, recorder.meteringDb, recorder.status]);
  const saveRecording = useCallback((): Promise<boolean> => {
    if (saveTask.current) return saveTask.current;
    const task = (async () => {
      setSaving(true);
      try {
        finalizedSeconds.current ??= Math.min(
          lesson.answerSeconds,
          Math.max(0, (Date.now() - startedAt.current) / 1000),
        );
        const seconds = finalizedSeconds.current;
        const result = await current.current.recorder.finish('user');
        const savedUri = await preserveLearningRecording(result.audioFileUri, result.generationId);
        const previous = current.current.take;
        const next: LearningTake = {
          uri: savedUri,
          seconds,
          inputDetected: soundSamples.current.available ? soundSamples.current.audible >= 3 : null,
        };
        current.current.onTake(next);
        setSaveFailed(false);
        recordingActive.current = false;
        // The lesson session owns this temporary copy across stage changes.
        current.current.recorder.transferOwnership(result.audioFileUri);
        try {
          new File(result.audioFileUri).delete();
        } catch {
          /* Cache cleanup may retry on OS eviction. */
        }
        if (previous && previous.uri !== next.uri) {
          try {
            const old = new File(previous.uri);
            if (old.exists) old.delete();
          } catch {
            /* The new take is already safe. */
          }
        }
        setMessage(getLearningTakeIssue(next) ?? '녹음을 저장했어요. 내 답변을 들어보세요.');
        return true;
      } catch {
        setSaveFailed(true);
        setMessage('녹음을 저장하지 못했어요. 화면을 유지했으니 다시 시도해 주세요.');
        return false;
      } finally {
        setSaving(false);
      }
    })();
    saveTask.current = task;
    void task.finally(() => {
      saveTask.current = null;
    });
    return task;
  }, [lesson.answerSeconds]);
  const { stop: stopAudio } = audio;
  const leave = useCallback(async () => {
    if (submission.busy) return false;
    stopAudio();
    await startTask.current;
    if (saveTask.current) return saveTask.current;
    const status = current.current.recorder.status;
    if (recordingActive.current || status === 'recording' || status === 'finalizing')
      return saveRecording();
    return true;
  }, [saveRecording, stopAudio, submission.busy]);
  useEffect(() => registerLeave(leave), [leave, registerLeave]);
  useEffect(() => {
    if (recorder.status === 'finalizing' && !saveTask.current && !saveFailed) void saveRecording();
  }, [recorder.status, saveFailed, saveRecording]);
  useEffect(() => {
    if (recorder.status === 'interrupted') recordingActive.current = false;
  }, [recorder.status]);
  const start = () => {
    if (startTask.current || saveTask.current) return;
    audio.stop();
    finalizedSeconds.current = null;
    setSaveFailed(false);
    soundSamples.current = { available: false, audible: 0 };
    startTask.current = (async () => {
      const result = await recorder.start({
        context: lesson.id,
        maxDurationMs: lesson.answerSeconds * 1000,
      });
      if (result.started) {
        recordingActive.current = true;
        startedAt.current = Date.now();
        setMessage('');
      } else setMessage('마이크를 사용할 수 없어요. 이전 녹음은 그대로 보관했어요.');
    })();
    void startTask.current.finally(() => {
      startTask.current = null;
    });
  };
  const recording = recorder.status === 'recording';
  const busy =
    saving || recorder.status === 'preparing' || (recorder.status === 'finalizing' && !saveFailed);
  const usable = isLearningTakeUsable(take) && !saveFailed;
  const takeIssue = getLearningTakeIssue(take);
  const gradingReady = gradingSupport.state.kind === 'ready';
  const paused = submission.state.kind === 'paused';
  const hasAnswerCard = lesson.part !== 1;
  const togglePlayback = () => {
    if (!take || busy || recording || saveFailed) return;
    if (audio.playing) audio.pause();
    else if (!audio.resume()) void audio.play(take.uri);
  };
  const cardState = ((): LearningAnswerCardState => {
    if (saveFailed) return { kind: 'retry', message: '아래 버튼으로 녹음을 다시 저장해 주세요.' };
    if (busy)
      return {
        kind: 'busy',
        message:
          recorder.status === 'preparing' ? '마이크를 준비하고 있어요.' : '녹음을 정리하고 있어요.',
      };
    if (recording)
      return {
        kind: 'recording',
        seconds: Math.min(lesson.answerSeconds, recorder.elapsedMs / 1000),
        limit: lesson.answerSeconds,
        meteringDb: recorder.meteringDb,
      };
    if (take) {
      const sameSource = audio.position.source === take.uri;
      return {
        kind: 'recorded',
        seconds: sameSource && audio.position.duration > 0 ? audio.position.duration : take.seconds,
        position: sameSource ? audio.position.seconds : 0,
        playing: audio.playing,
        paused: audio.paused,
        onPlayback: togglePlayback,
      };
    }
    return { kind: 'ready' };
  })();
  if (submission.busy)
    return (
      <View className="flex-1 items-center justify-center gap-lg px-screen">
        <ActivityIndicator size="large" color={colors.brand.text} />
        <Text accessibilityLiveRegion="polite" className="text-xl font-semibold">
          {submission.state.kind === 'uploading'
            ? '답변을 보내고 있어요'
            : '답변을 확인하고 있어요'}
        </Text>
        <Text className="text-center text-sm leading-6 text-ink-muted">
          {submission.state.kind === 'uploading'
            ? '녹음한 음성을 전송하고 있어요.'
            : submission.state.kind === 'processing' && submission.state.phase === 'grading'
              ? '문항별 체크리스트와 답변을 비교하고 있어요.'
              : '말씀하신 내용을 확인하고 있어요.'}
        </Text>
        <Button label="대기 그만하기" variant="neutral" onPress={submission.stopWaiting} />
        <Text className="text-center text-xs leading-5 text-ink-muted">
          녹음은 유지돼요. 이미 접수된 답변은 계속 처리될 수 있어요.
        </Text>
      </View>
    );
  return (
    <>
      {lesson.part !== 1 && gradingSupport.state.kind !== 'ready' ? (
        <View className="mx-screen mt-sm flex-row items-center gap-sm rounded-control border border-line bg-surface px-card py-sm">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-sm leading-5 text-ink-muted"
          >
            {gradingSupport.state.kind === 'checking'
              ? '채점 가능 여부를 확인하고 있어요.'
              : gradingSupport.state.message}
          </Text>
          {gradingSupport.state.kind === 'unavailable' ? (
            <Button
              label="재연결"
              size="sm"
              variant="text"
              onPress={() => void gradingSupport.refresh()}
            />
          ) : null}
        </View>
      ) : null}
      <LearningFrame
        lesson={lesson}
        stage="practice"
        label=""
        timer={
          recording
            ? `남은 ${Math.ceil(recorder.remainingMs / 1000)}초`
            : take
              ? `녹음 ${formatLearningTime(take.seconds)}`
              : `답변 ${lesson.answerSeconds}초`
        }
        onSourceOpen={async () => {
          const wasRecording = current.current.recorder.status === 'recording';
          const ok = await leave();
          if (ok && wasRecording)
            setMessage('녹음을 저장했어요. 확인한 뒤 이어서 듣거나 다시 녹음할 수 있어요.');
          return ok;
        }}
      >
        <View className={hasAnswerCard ? 'gap-sm py-sm' : 'gap-sm'}>
          {hasAnswerCard ? (
            <LearningAnswerCard state={cardState} />
          ) : take && !recording ? (
            <View className="gap-sm rounded-control border border-line bg-surface p-card">
              <Text className="text-sm text-ink-muted">
                내 답변 · {formatLearningTime(take.seconds)}
              </Text>
              <View className="h-1 overflow-hidden rounded-pill bg-line">
                <View
                  className="h-1 bg-brand"
                  style={{
                    width: `${Math.min(100, (audio.position.seconds / Math.max(1, take.seconds)) * 100)}%`,
                  }}
                />
              </View>
              <Text className="text-xs text-ink-muted">
                {formatLearningTime(audio.position.seconds)} / {formatLearningTime(take.seconds)}
              </Text>
            </View>
          ) : null}
          {recorder.status === 'permission-denied' ? (
            <Button
              label="마이크 설정 열기"
              variant="text"
              size="sm"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
        </View>
      </LearningFrame>
      <LearningControls
        busy={busy}
        message={
          audio.error ??
          (recording
            ? '말을 마치면 정지 버튼을 눌러 주세요.'
            : saveFailed
              ? message
              : (takeIssue ??
                (submission.state.kind === 'error'
                  ? submission.state.message
                  : paused
                    ? '대기를 멈췄어요. 결과를 다시 확인하거나 다른 연습으로 이동할 수 있어요.'
                    : message)))
        }
        primary={{
          label: saveFailed
            ? '녹음 다시 저장'
            : recording
              ? '녹음 끝내기'
              : take
                ? audio.playing
                  ? '재생 일시정지'
                  : audio.paused
                    ? '이어서 듣기'
                    : '내 답변 듣기'
                : '실전 답변 녹음',
          icon: saveFailed
            ? 'save'
            : recording
              ? 'square'
              : take
                ? audio.playing
                  ? 'pause'
                  : 'play'
                : 'mic',
          onPress: () => {
            if (recording || saveFailed) void saveRecording();
            else if (!take) start();
            else togglePlayback();
          },
        }}
        left={{
          label: '다시 녹음',
          icon: 'rotate-ccw',
          disabled: !take || recording || saveFailed,
          onPress: start,
        }}
        right={{
          label:
            lesson.part === 1
              ? '비교해서 듣기'
              : !gradingReady
                ? gradingSupport.state.kind === 'checking'
                  ? '채점 확인 중'
                  : gradingSupport.state.kind === 'unavailable'
                    ? '채점 연결 필요'
                    : '채점 준비 중'
                : paused
                  ? '결과 다시 확인'
                  : submission.state.kind === 'error'
                    ? '다시 제출'
                    : '답변 제출',
          caption: paused ? '결과 확인' : undefined,
          icon: lesson.part === 1 ? 'headphones' : 'send',
          disabled:
            !usable ||
            recording ||
            (lesson.part !== 1 && !gradingReady) ||
            (submission.state.kind === 'error' && !submission.state.canRetry),
          onPress: () => {
            audio.stop();
            if (lesson.part === 1) onComplete();
            else if (gradingReady) void submission.submit();
          },
        }}
      />
    </>
  );
}
