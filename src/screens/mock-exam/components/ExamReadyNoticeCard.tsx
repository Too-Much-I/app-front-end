import { Feather } from "@expo/vector-icons";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { EXAM_READY_NOTICES } from "@/features/exam/ready-notice";
import { colors, shadows } from "@/theme";

const ICON_SIZE = 19;

/**
 * 응시 전 안내 항목 목록.
 *
 * 항목마다 카드를 나누지 않고 한 장 안에 구분선으로 나눈다 — 4장으로 쪼개면
 * 크림 배경 위에 흰 덩어리가 네 번 반복돼 목록으로 안 읽히고, 세로도 넘친다.
 */
export function ExamReadyNoticeCard() {
  return (
    <View className="rounded-3xl bg-surface px-4" style={shadows.card}>
      {EXAM_READY_NOTICES.map((notice, index) => (
        <View
          key={notice.title}
          className={`flex-row items-start gap-3 py-4 ${index > 0 ? "border-t border-line" : ""}`}
        >
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-100">
            <Feather name={notice.icon} size={ICON_SIZE} color={colors.brand.text} />
          </View>
          <View className="flex-1">
            <Text className="text-base">{notice.title}</Text>
            <Text className="mt-0.5 text-sm text-ink-muted">
              {notice.description}
              {notice.highlight ? (
                <Text className="text-sm text-brand-text"> {notice.highlight}</Text>
              ) : null}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
