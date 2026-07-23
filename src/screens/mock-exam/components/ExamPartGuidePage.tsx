import { Feather } from "@expo/vector-icons";
import { Image, ScrollView, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { ExamPartGuide } from "@/features/exam/part-guide";
import { colors } from "@/theme";

interface ExamPartGuidePageProps {
  activeIndex: number;
  guide: ExamPartGuide;
  isLast: boolean;
  partCount: number;
  onNext: () => void;
  onSelectPart: (index: number) => void;
  onStart: () => void;
}

interface TimingItemProps {
  icon: "clock" | "mic";
  label: string;
  value: string;
}

function TimingItem({ icon, label, value }: TimingItemProps) {
  return (
    <View className="min-h-24 flex-1 items-center justify-center rounded-2xl border border-line bg-surface-muted px-3 py-4">
      <View className="flex-row items-center gap-2">
        <Feather name={icon} size={20} color={colors.ink.muted} />
        <Text className="text-base text-ink-muted">{label}</Text>
      </View>
      <Text className="mt-1.5 text-center text-xl">{value}</Text>
    </View>
  );
}

function PartProgress({
  activeIndex,
  partCount,
  onSelectPart,
}: Pick<ExamPartGuidePageProps, "activeIndex" | "partCount" | "onSelectPart">) {
  return (
    <View className="relative mb-7 mt-1 flex-row">
      <View
        className="absolute bg-line"
        style={{ height: 2, left: `${100 / partCount / 2}%`, right: `${100 / partCount / 2}%`, top: 11 }}
      />
      {Array.from({ length: partCount }, (_, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <Pressable
            key={index}
            accessibilityLabel={`Part ${index + 1}로 이동`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="flex-1 items-center"
            hitSlop={6}
            onPress={() => onSelectPart(index)}
          >
            <View className="h-6 items-center justify-center">
              <View
                className={`items-center justify-center rounded-full ${
                  isActive
                    ? "h-6 w-6 bg-brand-cta"
                    : isComplete
                      ? "h-2 w-2 bg-brand-cta"
                      : "h-2 w-2 bg-line"
                }`}
              >
                {isActive ? <Text className="text-sm text-white">{index + 1}</Text> : null}
              </View>
            </View>
            <Text className={`mt-2 text-sm ${isActive ? "text-brand-cta" : "text-ink-muted"}`}>
              Part {index + 1}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ExamPartGuidePage({
  activeIndex,
  guide,
  isLast,
  partCount,
  onNext,
  onSelectPart,
  onStart,
}: ExamPartGuidePageProps) {
  const mascotSize = {
    height: "100%" as const,
    maxHeight: 200,
    maxWidth: 190,
    transform: [{ scale: guide.mascotScale }],
    width: "52%" as const,
  };

  return (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow px-10 pb-6 pt-6"
    >
      <PartProgress
        activeIndex={activeIndex}
        partCount={partCount}
        onSelectPart={onSelectPart}
      />

      <View>
        <View className="flex-row items-center gap-2">
          <Text className="text-2xl text-brand">{guide.part}</Text>
          <Text className="text-base text-ink-muted">{guide.questionNumbers}</Text>
        </View>
        <Text className="mt-0.5 text-3xl">{guide.questionType}</Text>
        <Text className="mt-2 max-w-xs text-base leading-6 text-ink-muted">
          {guide.answerGuide}
        </Text>
      </View>

      <View className="min-h-36 flex-1 items-end justify-center py-2">
        <Image source={guide.mascot} style={mascotSize} resizeMode="contain" />
      </View>

      <View className="flex-row items-stretch gap-3">
        <TimingItem icon="clock" label="준비 시간" value={guide.prepTime} />
        <TimingItem icon="mic" label="답변 시간" value={guide.answerTime} />
      </View>

      <Pressable
        className="mt-6 items-center justify-center rounded-2xl bg-brand-cta py-4"
        onPress={isLast ? onStart : onNext}
      >
        <Text className="text-lg text-white">{isLast ? "시작하기" : "다음 파트"}</Text>
      </Pressable>
    </ScrollView>
  );
}
