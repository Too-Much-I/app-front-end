import { Image, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";

const errorMascot = require("../../../../public/mascots/error.png");

interface GradingFailedNoticeProps {
  onGoHome: () => void;
}

/**
 * 재요청 접수 실패 또는 두 번째 채점 실패 뒤의 최종 오류 화면.
 *
 * 사용 가능한 재요청을 이미 소진한 상태이므로 추가 Retry는 제공하지 않는다.
 */
export function GradingFailedNotice({ onGoHome }: GradingFailedNoticeProps) {
  return (
    <View
      accessibilityLiveRegion="assertive"
      className="w-full max-w-xl items-center self-center rounded-2xl border border-exam-dangerLine bg-surface p-6"
    >
      <Image
        accessible
        accessibilityLabel="채점 실패를 알리는 토끼 캐릭터"
        className="h-44 w-44"
        resizeMode="contain"
        source={errorMascot}
      />
      <Text className="mt-4 text-center text-xl text-exam-danger">
        채점을 마치지 못했어요
      </Text>
      <Text className="mt-2 text-center text-sm leading-6 text-ink-muted">
        답변은 그대로 보관돼 있어요. 홈으로 돌아간 뒤 잠시 후 다시 확인해주세요.
      </Text>
      <Pressable
        accessibilityHint="끝난 모의고사 화면을 닫고 홈 탭으로 이동합니다"
        accessibilityRole="button"
        className="mt-6 min-h-11 w-full items-center justify-center rounded-2xl bg-brand-cta py-3.5"
        onPress={onGoHome}
      >
        <Text className="text-base text-white">홈으로 돌아가기</Text>
      </Pressable>
    </View>
  );
}
