import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Part4Table } from "@/components/exam/Part4Table";
import { Pressable } from "@/components/ui/Pressable";
import { colors } from "@/theme";
import type { ExamTableContext } from "@/types/exam";

interface Part4TableLandscapeModalProps {
  visible: boolean;
  table: ExamTableContext;
  /** 세로 복귀 요청이 이미 chain에 들어가 중복 close를 막아야 하는 상태. */
  transitioning: boolean;
  onRequestClose: () => void;
}

/** 시험 controller를 그대로 mount한 채 표 presentation만 대체하는 native modal. */
export function Part4TableLandscapeModal({
  visible,
  table,
  transitioning,
  onRequestClose,
}: Part4TableLandscapeModalProps) {
  // expo-status-bar는 Modal visibility와 별개로 React mount 상태를 따른다.
  // 보이지 않을 때 subtree 자체를 내리지 않으면 세로 시험 화면의 status bar도 숨는다.
  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      navigationBarTranslucent
      presentationStyle="fullScreen"
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      visible
      onRequestClose={onRequestClose}
    >
      <StatusBar hidden />
      <SafeAreaView
        accessibilityViewIsModal
        className="relative flex-1 bg-surface"
        edges={["top", "right", "bottom", "left"]}
      >
        <Pressable
          accessibilityHint="현재 시험 단계의 세로 화면으로 돌아갑니다"
          accessibilityLabel={
            transitioning ? "표 축소 중" : "표 축소하고 세로 화면으로 돌아가기"
          }
          accessibilityRole="button"
          accessibilityState={{ disabled: transitioning }}
          className={`absolute right-5 top-3 z-20 h-11 w-11 items-center justify-center rounded-full border ${
            transitioning
              ? "border-line bg-surface-muted"
              : "border-brand-300 bg-surface"
          }`}
          disabled={transitioning}
          hitSlop={4}
          onPress={onRequestClose}
        >
          <Feather
            color={transitioning ? colors.ink.disabled : colors.brand.text}
            name="minimize-2"
            size={21}
          />
        </Pressable>

        <ScrollView
          bounces={false}
          className="flex-1"
          contentContainerClassName="flex-grow px-6 py-5"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <View className="mx-auto w-full">
            {/* onReady를 넘기지 않아 modal layout이 45초 timer를 다시 시작하지 않는다. */}
            <Part4Table table={table} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
