import { ActivityIndicator, Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { ChallengeStatusOnly } from "@/screens/ten-second-challenge/challenge-ui";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const micRabbit = require("../../../../public/mascots/mic_rabbit.png");
const errorRabbit = require("../../../../public/mascots/error.png");

type ChallengeNoticeStatus = Exclude<ChallengeStatusOnly, "loading" | "submitting">;

interface ChallengeStatusPanelProps {
  /** 조회 중은 여기 없다 — 스켈레톤이 노트 자리를 대신 지킨다. */
  status: Exclude<ChallengeStatusOnly, "loading">;
  /** 제출 실패 문구는 업로드 단계마다 달라서 훅이 준 것을 그대로 보여준다. */
  errorMessage: string | null;
  onOpenSettings: () => void;
  onRetryQuestion: () => void;
  onRetryRecording: () => void;
  onRetrySubmit: () => void;
  onLeave: () => void;
}

interface StatusAction {
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * 노트 카드 대신 화면 전체를 채우는 안내 한 장.
 *
 * 세 실패 모두 그 자리에서 고칠 수 있어서 첫 번째 버튼은 항상 다시 시도다.
 * 스테이지로 돌아가는 길은 두 번째 버튼으로 남겨둔다 — 오늘의 다른 문장은 그대로 있다.
 */
export function ChallengeStatusPanel({
  status,
  errorMessage,
  onOpenSettings,
  onRetryQuestion,
  onRetryRecording,
  onRetrySubmit,
  onLeave,
}: ChallengeStatusPanelProps) {
  // 제출은 스켈레톤을 쓰지 않는다. 도착할 내용이 있는 게 아니라 작업이 진행 중이고,
  // 얼마나 걸릴지는 업로드 상황에 달려 있어서 자리를 미리 잡아줄 것이 없다.
  if (status === "submitting") {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-5">
        <ActivityIndicator color={colors.brand.cta} size="large" />
        <Text className="text-sm text-ink-muted">제출하는 중이에요...</Text>
      </View>
    );
  }

  const notice = getStatusNotice(status);
  const actions = getStatusActions(status, {
    onOpenSettings,
    onRetryQuestion,
    onRetryRecording,
    onRetrySubmit,
    onLeave,
  });

  return (
    <View className="flex-1 items-center justify-center gap-5 px-5">
      <Image
        accessibilityElementsHidden
        className="h-40 w-40"
        resizeMode="contain"
        source={notice.mascot}
      />

      <View className="w-full items-center rounded-3xl bg-surface p-5" style={shadows.card}>
        <Text className="text-center text-base leading-6 text-exam-danger">
          {errorMessage ?? notice.title}
        </Text>
        <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
          {notice.description}
        </Text>

        <View className="mt-5 w-full gap-2">
          {actions.map((action, index) => (
            <Pressable
              accessibilityHint={action.hint}
              accessibilityLabel={action.label}
              accessibilityRole="button"
              className={`w-full items-center rounded-full py-3 ${
                index === 0 ? "bg-brand-cta" : "border border-line bg-surface"
              }`}
              key={action.label}
              onPress={action.onPress}
            >
              <Text className={`text-sm ${index === 0 ? "text-white" : "text-ink-muted"}`}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function getStatusNotice(status: ChallengeNoticeStatus) {
  switch (status) {
    case "question-failed":
      return {
        mascot: errorRabbit,
        title: "오늘의 문장을 불러오지 못했어요.",
        description: "잠시 뒤 다시 시도해 주세요.",
      };
    case "permission-denied":
      return {
        mascot: micRabbit,
        title: "마이크를 사용할 수 없어요.",
        description: "마이크 권한을 켜야 10초 챌린지를 말할 수 있어요.",
      };
    case "record-failed":
      return {
        mascot: micRabbit,
        title: "마이크를 준비하지 못했어요.",
        description: "다른 앱이 마이크를 쓰고 있는지 확인한 뒤 다시 시도해 주세요.",
      };
    case "submit-failed":
      return {
        mascot: errorRabbit,
        title: "제출 중 문제가 생겼어요.",
        description: "녹음본은 아직 남아 있어요. 다시 제출하거나 처음부터 녹음할 수 있어요.",
      };
  }
}

function getStatusActions(
  status: ChallengeNoticeStatus,
  handlers: {
    onOpenSettings: () => void;
    onRetryQuestion: () => void;
    onRetryRecording: () => void;
    onRetrySubmit: () => void;
    onLeave: () => void;
  },
): StatusAction[] {
  const goBack: StatusAction = {
    label: "오늘의 진행도로 돌아가기",
    hint: "이 문장을 그만두고 스테이지 화면으로 돌아갑니다",
    onPress: handlers.onLeave,
  };

  switch (status) {
    case "question-failed":
      return [
        {
          label: "다시 불러오기",
          hint: "오늘의 문장을 다시 요청합니다",
          onPress: handlers.onRetryQuestion,
        },
        goBack,
      ];
    case "permission-denied":
      return [
        {
          label: "앱 설정에서 권한 허용",
          hint: "시스템 설정에서 마이크 권한을 켤 수 있습니다",
          onPress: handlers.onOpenSettings,
        },
        goBack,
      ];
    case "record-failed":
      return [
        {
          label: "다시 녹음",
          hint: "녹음을 처음부터 다시 시작합니다",
          onPress: handlers.onRetryRecording,
        },
        goBack,
      ];
    // 업로드가 실패해도 녹음본은 그대로라, 같은 파일을 다시 올리는 게 첫 번째 회복이다.
    case "submit-failed":
      return [
        {
          label: "다시 제출",
          hint: "방금 녹음한 답변을 다시 올립니다",
          onPress: handlers.onRetrySubmit,
        },
        {
          label: "다시 녹음",
          hint: "녹음을 처음부터 다시 시작합니다",
          onPress: handlers.onRetryRecording,
        },
      ];
  }
}
