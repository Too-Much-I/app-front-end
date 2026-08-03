import { ActivityIndicator, Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { GradingRabbitBanner } from "@/screens/mock-exam/components/GradingRabbitBanner";
import type { ReanswerStatusOnly } from "@/screens/reanswer/reanswer-ui";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const micRabbit = require("../../../../public/mascots/mic_rabbit.png");
const errorRabbit = require("../../../../public/mascots/error.png");
const waitingRabbit = require("../../../../public/mascots/waiting_rabbit_tight.png");

type ReanswerNoticeStatus = Exclude<
  ReanswerStatusOnly,
  "loading" | "submitting" | "grading"
>;

interface ReanswerStatusPanelProps {
  status: ReanswerStatusOnly;
  errorMessage: string | null;
  onOpenSettings: () => void;
  onRetryRecording: () => void;
  onLeave: () => void;
}

interface StatusAction {
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * 문제 카드 대신 화면 전체를 채우는 안내 한 장.
 *
 * 제출·채점 문구는 웹 재답변(`useReanswerSubmission`)의 상태 문구를 그대로 쓴다.
 *
 * 실패한 자리에서 서버를 다시 부르지 않는다 — 어떤 실패든 문제별 피드백으로 돌아가고,
 * 재답변은 거기서 다시 시작한다. 설정 열기와 다시 녹음만 예외인데, 둘 다 서버를 부르지
 * 않고 사용자가 그 자리에서 고칠 수 있는 일이라서다.
 */
export function ReanswerStatusPanel({
  status,
  errorMessage,
  onOpenSettings,
  onRetryRecording,
  onLeave,
}: ReanswerStatusPanelProps) {
  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-5">
        <ActivityIndicator color={colors.brand.cta} size="large" />
        <Text className="text-sm text-ink-muted">문제를 불러오고 있어요...</Text>
      </View>
    );
  }

  if (status === "submitting" || status === "grading") {
    return (
      <View className="flex-1 items-center justify-center px-5">
        <View
          className="w-full items-center overflow-hidden rounded-3xl bg-surface pb-6"
          style={shadows.card}
        >
          <GradingRabbitBanner />
          <Text className="text-base text-brand-text">
            {status === "submitting"
              ? "제출하는 중이에요..."
              : "제출했어요! 채점 중이에요..."}
          </Text>
          {status === "grading" ? (
            <Text className="mt-1 text-sm text-brand-cta">
              채점이 끝나면 자동으로 결과를 보여드릴게요.
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  const notice = getStatusNotice(status);
  const actions = getStatusActions(status, {
    onOpenSettings,
    onRetryRecording,
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

function getStatusNotice(status: ReanswerNoticeStatus) {
  switch (status) {
    case "question-failed":
      return {
        mascot: errorRabbit,
        title: "문제를 불러오지 못했어요.",
        description: "피드백 화면에서 다시 시작해 주세요.",
      };
    case "permission-denied":
      return {
        mascot: micRabbit,
        title: "마이크를 사용할 수 없어요.",
        description: "마이크 권한을 확인해 주세요.",
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
        description: "이번 녹음은 저장되지 않았어요. 피드백 화면에서 다시 시작해 주세요.",
      };
    case "grading-failed":
      return {
        mascot: waitingRabbit,
        title: "채점 결과를 확인하지 못했어요.",
        description: "답변은 접수됐어요. 피드백 화면에서 잠시 후 다시 확인해 주세요.",
      };
  }
}

function getStatusActions(
  status: ReanswerNoticeStatus,
  handlers: {
    onOpenSettings: () => void;
    onRetryRecording: () => void;
    onLeave: () => void;
  },
): StatusAction[] {
  const goBack: StatusAction = {
    label: "피드백으로 돌아가기",
    hint: "재답변을 그만두고 문제별 피드백으로 돌아갑니다",
    onPress: handlers.onLeave,
  };

  switch (status) {
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
    case "question-failed":
    case "submit-failed":
    case "grading-failed":
      return [goBack];
  }
}
