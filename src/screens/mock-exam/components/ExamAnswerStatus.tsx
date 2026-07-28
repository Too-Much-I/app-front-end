import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Linking, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { AnswerRecordingStatus } from "@/features/exam/use-answer-recorder";
import type { ExamSessionPhase } from "@/screens/mock-exam/hooks/use-exam-session-controller";
import { colors } from "@/theme";
import type {
  AnswerKey,
  AnswerSubmissionJob,
  AnswerSubmissionSummary,
} from "@/types/exam";

const errorMascot = require("../../../../public/mascots/error.png");
const scoringMascot = require("../../../../public/mascots/scoring.png");

interface ExamAnswerStatusProps {
  phase: ExamSessionPhase;
  recordingStatus: AnswerRecordingStatus;
  canAskPermissionAgain: boolean;
  recordingErrorMessage?: string;
  jobs: AnswerSubmissionJob[];
  summary: AnswerSubmissionSummary;
  onRetryRecording: () => void;
  onRetryRegistration: () => void;
  onRetrySubmission: (key: AnswerKey) => void;
  onGoHome: () => void;
}

function RecoveryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      className="mt-4 items-center rounded-xl bg-brand-cta px-5 py-3"
      onPress={onPress}
    >
      <Text className="text-base text-white">{label}</Text>
    </Pressable>
  );
}

export function ExamAnswerStatus({
  phase,
  recordingStatus,
  canAskPermissionAgain,
  recordingErrorMessage,
  jobs,
  summary,
  onRetryRecording,
  onRetryRegistration,
  onRetrySubmission,
  onGoHome,
}: ExamAnswerStatusProps) {
  const permissionDenied = recordingStatus === "permission-denied";

  if (phase === "completed") {
    return (
      <View accessibilityLiveRegion="polite" className="items-center rounded-2xl bg-sky-surface p-6">
        <Image
          accessible
          accessibilityLabel="답변 채점 시작을 알리는 고양이 캐릭터"
          className="h-44 w-52"
          resizeMode="contain"
          source={scoringMascot}
        />
        <Text className="mt-3 text-center text-xl text-sky-text">모든 답변을 제출했어요</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
          채점이 시작됐습니다. 결과는 완료 후 확인할 수 있어요.
        </Text>
      </View>
    );
  }

  if (phase === "submission-barrier") {
    const failedJobs = jobs.filter((job) => job.stage === "failed");
    const retryableFailedJobs = failedJobs.filter((job) => job.lastError?.retryable);

    if (failedJobs.length > 0 && summary.pendingCount === 0) {
      return (
        <View
          accessibilityLiveRegion="assertive"
          className="w-full max-w-xl self-center items-center rounded-2xl border border-exam-dangerLine bg-surface p-6"
        >
          <Image
            accessible
            accessibilityLabel="답변 제출 실패를 알리는 토끼 캐릭터"
            className="h-52 w-52"
            resizeMode="contain"
            source={errorMascot}
          />
          <Text className="mt-4 text-center text-xl text-exam-danger">
            답변을 제출하지 못했어요
          </Text>
          <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
            {retryableFailedJobs.length > 0
              ? "네트워크나 서버 연결이 안정된 뒤 다시 시도하거나 홈으로 돌아가주세요."
              : "현재 요청은 다시 보내도 해결되지 않아요. 홈으로 돌아간 뒤 다시 시작해주세요."}
          </Text>

          {retryableFailedJobs.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="mt-6 w-full items-center rounded-2xl bg-brand-cta py-3.5"
              onPress={() => {
                for (const job of retryableFailedJobs) onRetrySubmission(job.key);
              }}
            >
              <Text className="text-base text-white">다시 시도</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            className={`${retryableFailedJobs.length > 0 ? "mt-3" : "mt-6"} w-full items-center rounded-2xl border border-brand-300 py-3.5`}
            onPress={onGoHome}
          >
            <Text className="text-base text-brand-text">홈으로 돌아가기</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View accessibilityLiveRegion="polite" className="w-full rounded-2xl border border-line bg-surface p-5">
        <View className="flex-row items-center gap-3">
          {summary.pendingCount > 0 ? (
            <ActivityIndicator color={colors.brand.cta} />
          ) : (
            <MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.brand.text} />
          )}
          <View className="flex-1">
            <Text className="text-lg">답변을 제출하고 있어요</Text>
            <Text className="mt-1 text-sm text-ink-muted">
              {summary.succeededCount}/{summary.registeredCount}개 제출 완료
            </Text>
          </View>
        </View>

        {failedJobs.map((job) => (
          <View
            key={`${job.key.questionNumber}:${job.key.retryCount}`}
            className="mt-4 rounded-xl bg-surface-muted p-4"
          >
            <Text className="text-sm text-ink-muted">문항 {job.key.questionNumber}</Text>
            <Text className="mt-1 text-sm text-exam-danger">
              {job.lastError?.message ?? "제출 상태를 확인하지 못했어요."}
            </Text>
            {job.lastError?.retryable ? (
              <Pressable
                accessibilityRole="button"
                className="mt-3 self-start rounded-full border border-brand-300 px-4 py-2"
                onPress={() => onRetrySubmission(job.key)}
              >
                <Text className="text-sm text-brand-text">이 단계 다시 시도</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  if (phase === "registration-recovery") {
    return (
      <View accessibilityLiveRegion="assertive" className="w-full rounded-2xl border border-exam-dangerLine bg-surface p-5">
        <Text className="text-center text-lg text-exam-danger">답변 파일 등록이 끝나지 않았어요</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
          녹음 파일은 그대로 보관 중이에요. 다시 녹음하지 않고 등록만 재시도합니다.
        </Text>
        <RecoveryButton label="답변 파일 다시 등록" onPress={onRetryRegistration} />
      </View>
    );
  }

  if (phase === "interrupted") {
    return (
      <View accessibilityLiveRegion="assertive" className="w-full rounded-2xl border border-exam-dangerLine bg-surface p-5">
        <Text className="text-center text-lg text-exam-danger">녹음이 중단됐어요</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
          부분 녹음은 제출하지 않았습니다. 현재 문항을 전체 시간으로 다시 녹음해주세요.
        </Text>
        <RecoveryButton label="현재 문항 다시 녹음" onPress={onRetryRecording} />
      </View>
    );
  }

  if (phase === "recording-recovery") {
    return (
      <View accessibilityLiveRegion="assertive" className="w-full rounded-2xl border border-exam-dangerLine bg-surface p-5">
        <Text className="text-center text-lg text-exam-danger">
          {permissionDenied ? "마이크 권한이 필요해요" : "답변 녹음을 완료하지 못했어요"}
        </Text>
        <Text className="mt-2 text-center text-sm leading-5 text-ink-muted">
          {permissionDenied
            ? "마이크 권한을 허용한 뒤 현재 문항을 다시 시작해주세요."
            : recordingErrorMessage ?? "유효한 파일이 없어 현재 문항에 머물러 있어요."}
        </Text>
        {permissionDenied && !canAskPermissionAgain ? (
          <RecoveryButton
            label="앱 설정에서 권한 허용"
            onPress={() => {
              void Linking.openSettings().catch((error: unknown) => {
                console.error("[ExamSession] 앱 설정 화면 열기 실패", error);
              });
            }}
          />
        ) : (
          <RecoveryButton label="현재 문항 다시 녹음" onPress={onRetryRecording} />
        )}
      </View>
    );
  }

  if (phase === "starting-response" || phase === "finalizing") {
    return (
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 py-2">
        <ActivityIndicator color={colors.brand.cta} />
        <Text className="text-sm text-ink-muted">
          {phase === "starting-response" ? "마이크를 준비하고 있어요" : "답변 파일을 확정하고 있어요"}
        </Text>
      </View>
    );
  }

  if (phase === "response") {
    return (
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 py-1">
        <View className="h-2.5 w-2.5 rounded-full bg-exam-danger" />
        <Text className="text-sm text-ink-muted">답변을 녹음하고 있어요</Text>
      </View>
    );
  }

  return null;
}
