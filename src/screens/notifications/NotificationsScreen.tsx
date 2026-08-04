import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { RootStackParamList } from "@/navigation/types";
import {
  MOCK_NOTIFICATIONS,
  type NotificationCategory,
  type NotificationItem,
  type NotificationType,
} from "@/screens/notifications/mocks/mock-notifications";
import { colors, shadows } from "@/theme";

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const bannerMascot = require("../../../public/mascots/bell_rabbit.png");

type NotificationsScreenProps = NativeStackScreenProps<RootStackParamList, "Notifications">;

type FeatherIconName = ComponentProps<typeof Feather>["name"];

type FilterKey = "all" | NotificationCategory;

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "study", label: "학습 알림" },
  { key: "event", label: "이벤트" },
  { key: "service", label: "서비스" },
];

/**
 * 알림 종류 → 아이콘/색 매핑.
 * 새 종류가 늘어나면 이 표에 한 줄만 추가하면 되고, 나머지 렌더링 로직은 그대로 재사용된다.
 */
const NOTIFICATION_META: Record<NotificationType, { icon: FeatherIconName; iconColor: string; badgeColor: string }> = {
  study_reminder: {
    icon: "bell",
    iconColor: colors.brand.DEFAULT,
    badgeColor: colors.brand[100],
  },
  grading_complete: {
    icon: "award",
    iconColor: colors.feedback.positive,
    badgeColor: colors.feedback.positiveSoft,
  },
  growth: {
    icon: "trending-up",
    iconColor: colors.feedback.history.purple,
    badgeColor: colors.feedback.history.purpleSoft,
  },
  event: {
    icon: "gift",
    iconColor: colors.feedback.improvement,
    badgeColor: colors.feedback.improvementSoft,
  },
  tip: {
    icon: "star",
    iconColor: colors.feedback.caution,
    badgeColor: colors.feedback.cautionSoft,
  },
  service_notice: {
    icon: "volume-2",
    iconColor: colors.sky.text,
    badgeColor: colors.sky.surface,
  },
  goal_achieved: {
    icon: "check-square",
    iconColor: colors.feedback.positive,
    badgeColor: colors.feedback.positiveSoft,
  },
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateGroupLabel(createdAt: string, now: Date): string {
  const date = new Date(createdAt);
  if (isSameCalendarDay(date, now)) return "오늘";
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_LABELS[date.getDay()]})`;
}

function timeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  const hours = date.getHours();
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${period} ${displayHour}:${minutes}`;
}

type NotificationSection = { label: string; items: NotificationItem[] };

/** 이미 최신순으로 정렬된 목록을 받아, 연속된 같은 날짜 라벨끼리 묶는다. */
function groupByDate(items: readonly NotificationItem[], now: Date): NotificationSection[] {
  const sections: NotificationSection[] = [];
  for (const item of items) {
    const label = dateGroupLabel(item.createdAt, now);
    const lastSection = sections[sections.length - 1];
    if (lastSection && lastSection.label === label) {
      lastSection.items.push(item);
    } else {
      sections.push({ label, items: [item] });
    }
  }
  return sections;
}

function NotificationCard({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const meta = NOTIFICATION_META[item.type];

  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${item.body}, ${item.isRead ? "읽음" : "안 읽음"}`}
      className="relative flex-row items-start gap-3 rounded-3xl border border-line bg-surface p-4"
      style={shadows.card}
      onPress={onPress}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: meta.badgeColor }}
      >
        <Feather name={meta.icon} size={18} color={meta.iconColor} />
      </View>

      <View className="min-w-0 flex-1 pr-10">
        <View className="flex-row items-center gap-1.5">
          <Text className="min-w-0 flex-1 text-base" numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text className="mt-1 text-sm leading-5 text-ink-muted">{item.body}</Text>
      </View>

      <Text className="absolute right-4 top-4 text-xs text-ink-disabled">
        {timeLabel(item.createdAt)}
      </Text>
      <View
        className="absolute bottom-3 right-4 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: item.isRead ? colors.ink.disabled : colors.brand.DEFAULT }}
      />
    </Pressable>
  );
}

export function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => [
    ...MOCK_NOTIFICATIONS,
  ]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>("all");

  const hasReadNotifications = notifications.some((item) => item.isRead);

  const sections = useMemo(() => {
    const filtered =
      selectedFilter === "all"
        ? notifications
        : notifications.filter((item) => item.category === selectedFilter);
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return groupByDate(sorted, new Date());
  }, [notifications, selectedFilter]);

  const handlePressItem = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    );
  };

  const handleDeleteAllRead = () => {
    setNotifications((prev) => prev.filter((item) => !item.isRead));
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center justify-between px-5">
        <View className="flex-row items-center">
          <Pressable
            accessibilityLabel="뒤로 가기"
            className="h-10 w-10 items-center justify-center rounded-full"
            hitSlop={8}
            onPress={navigation.goBack}
          >
            <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
          </Pressable>
          <Text className="ml-2 text-2xl">알림</Text>
        </View>

        {hasReadNotifications ? (
          <Pressable
            accessibilityLabel="읽은 알림 모두 삭제"
            className="flex-row items-center gap-1 px-1 py-2"
            hitSlop={8}
            onPress={handleDeleteAllRead}
          >
            <Text className="text-sm text-ink-muted">읽은 알림 모두 삭제</Text>
            <Feather name="trash-2" size={16} color={colors.ink.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-10 pt-2">
          <View
            className="flex-row items-center gap-4 overflow-hidden rounded-3xl border border-line bg-brand-50 p-5"
            style={shadows.card}
          >
            <View className="min-w-0 flex-1">
              <Text className="text-lg leading-7">토선생의 알림이에요!</Text>
              <Text className="mt-2 text-sm leading-6 text-ink-muted">
                꾸준한 연습이 실력 향상의 지름길!{"\n"}오늘도 화이팅이에요 💪
              </Text>
            </View>
            <Image
              source={bannerMascot}
              className="h-20 w-16"
              resizeMode="contain"
              accessible={false}
            />
          </View>

          <View
            accessibilityRole="tablist"
            className="mt-4 flex-row flex-wrap gap-2"
          >
            {FILTERS.map((filter) => {
              const isSelected = filter.key === selectedFilter;
              return (
                <Pressable
                  key={filter.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected ? "border-brand bg-surface" : "border-transparent bg-surface-muted"
                  }`}
                  onPress={() => setSelectedFilter(filter.key)}
                >
                  <Text className={`text-sm ${isSelected ? "text-brand-text" : "text-ink-muted"}`}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {sections.length === 0 ? (
            <View className="mt-10 items-center">
              <Text className="text-sm text-ink-muted">표시할 알림이 없어요.</Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.label} className="mt-5">
                <Text className="text-sm text-ink-muted">{section.label}</Text>
                <View className="mt-2 gap-3">
                  {section.items.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onPress={() => handlePressItem(item.id)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
