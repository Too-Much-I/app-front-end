import { Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  CORRECTION_SEVERITY_LABEL,
  getCorrectionSeverityColor,
  getCorrectionTypeLabel,
  normalizeCorrectionSeverity,
} from "@/screens/challenge/challenge-corrections";
import { shadows } from "@/theme";
import type { ChallengeCorrectionItem } from "@/types/challenge";

interface ChallengeCorrectionSheetProps {
  /** 이 문장의 첨삭 전체. 밑줄을 못 그은 항목도 여기 그대로 들어 있다. */
  items: ChallengeCorrectionItem[];
  /** 열려 있는 항목의 인덱스. `null`이면 닫힌 상태다. */
  index: number | null;
  /** 시트 하단 이동. 여는 쪽과 넘기는 쪽이 같은 상태를 쓰도록 화면이 인덱스를 소유한다. */
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/**
 * 첨삭 항목 하나를 아래에서 올라오는 시트로 보여준다.
 *
 * 라이브러리를 붙이지 않고 RN 내장 `Modal`을 쓴다 — `MascotModal`·`ConfirmModal`과 같은
 * 방식이라 안드로이드 뒤로 가기도 `onRequestClose` 하나로 끝난다. `animationType="slide"`가
 * 올라오는 동작을 대신 해주므로 애니메이션 코드가 없다. 다만 이 프롭은 모달 내용 전체를
 * 밀어 올리기 때문에 뒤를 덮는 어둠도 시트와 함께 올라온다. 어둠만 먼저 깔리게 하려면
 * `animationType="fade"`로 바꾸고 시트에 `Animated` translateY를 직접 걸어야 한다.
 *
 * 항목 이동을 시트 안에 둔 이유는 바텀시트의 약점을 덮기 위해서다 — 없으면 지적을
 * 옮겨 볼 때마다 닫고 다음 밑줄을 문장에서 다시 찾아야 한다.
 */
export function ChallengeCorrectionSheet({
  items,
  index,
  onIndexChange,
  onClose,
}: ChallengeCorrectionSheetProps) {
  const insets = useSafeAreaInsets();
  const item = index === null ? undefined : items[index];

  // 인덱스가 있어도 항목이 없으면(목록이 갱신된 직후) 그릴 것이 없다.
  if (index === null || !item) return null;

  const severity = normalizeCorrectionSeverity(item.severity);
  const severityColor = getCorrectionSeverityColor(item.severity);
  const hasPrevious = index > 0;
  const hasNext = index < items.length - 1;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View className="flex-1 justify-end bg-ink/40">
        {/* 시트 위 빈 곳을 눌러 닫는다. 시각적 요소가 아니라 닫기 영역이라 라벨만 준다. */}
        <Pressable
          accessibilityLabel="첨삭 설명 닫기"
          accessibilityRole="button"
          className="flex-1"
          onPress={onClose}
        />

        <View
          accessibilityViewIsModal
          className="rounded-t-3xl bg-surface px-5 pt-3"
          style={[shadows.card, { paddingBottom: insets.bottom + 20 }]}
        >
          <View className="h-1 w-10 self-center rounded-full bg-line" />

          <View className="mt-3 flex-row items-center gap-2">
            <View className="rounded-full bg-surface-muted px-2 py-0.5">
              <Text className="text-[11px] text-ink-muted">
                {getCorrectionTypeLabel(item.type)}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${severityColor}2E` }}
            >
              <Text className="text-[11px]" style={{ color: severityColor }}>
                {CORRECTION_SEVERITY_LABEL[severity]}
              </Text>
            </View>
          </View>

          <Text accessibilityRole="header" className="mt-3 text-lg leading-7">
            {item.issue}
          </Text>
          <Text className="mt-2 text-sm leading-6 text-ink-muted">{item.explanation}</Text>

          <View className="mt-4 rounded-2xl border border-sky-line bg-sky-surface px-4 py-3">
            <Text className="text-base leading-6 text-sky-text">
              {item.original} → {item.suggested}
            </Text>
          </View>

          <View className="mt-4 flex-row items-center justify-between border-t border-line pt-3">
            <Pressable
              accessibilityHint="이전 지적을 봅니다"
              accessibilityLabel="이전"
              accessibilityRole="button"
              className="px-2 py-1"
              disabled={!hasPrevious}
              onPress={() => onIndexChange(index - 1)}
            >
              <Text className={`text-sm ${hasPrevious ? "text-brand-text" : "text-line"}`}>
                ‹ 이전
              </Text>
            </Pressable>

            <Text className="text-xs tabular-nums text-ink-muted">
              {index + 1} / {items.length}
            </Text>

            <Pressable
              accessibilityHint="다음 지적을 봅니다"
              accessibilityLabel="다음"
              accessibilityRole="button"
              className="px-2 py-1"
              disabled={!hasNext}
              onPress={() => onIndexChange(index + 1)}
            >
              <Text className={`text-sm ${hasNext ? "text-brand-text" : "text-line"}`}>
                다음 ›
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
