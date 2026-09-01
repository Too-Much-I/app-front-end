import { useEffect, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import {
  HISTORY_TABS,
  type HistoryTab,
  TAB_TRANSITION_DURATION_MS,
  tabIndexOf,
} from "@/screens/feedback/exam-history-tabs";

export function HistoryTabs({
  selectedTab,
  onSelect,
}: {
  selectedTab: HistoryTab;
  onSelect: (tab: HistoryTab) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const tabWidth = trackWidth / HISTORY_TABS.length;
  const indicatorOffset = useSharedValue(0);

  useEffect(() => {
    const nextOffset = tabWidth * tabIndexOf(selectedTab);
    // 폭을 재기 전에는 애니메이션 없이 자리만 잡는다.
    indicatorOffset.value =
      reduceMotion || tabWidth === 0
        ? nextOffset
        : withTiming(nextOffset, {
            duration: TAB_TRANSITION_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          });
  }, [indicatorOffset, reduceMotion, selectedTab, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorOffset.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View accessibilityRole="tablist" className="rounded-2xl bg-surface-muted p-1">
      <View className="flex-row" onLayout={handleLayout}>
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-0 left-0 top-0 rounded-xl border border-brand bg-surface"
            style={[{ width: tabWidth }, indicatorStyle]}
          />
        )}

        {HISTORY_TABS.map((tab) => {
          const isSelected = tab.key === selectedTab;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              className="flex-1 items-center rounded-xl py-3"
              onPress={() => onSelect(tab.key)}
            >
              <Text
                className={`text-base ${isSelected ? "text-brand-text" : "text-ink-muted"}`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
