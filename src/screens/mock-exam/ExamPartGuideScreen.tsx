import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { EXAM_PART_GUIDES } from "@/features/exam/part-guide";
import type { MockExamStackParamList } from "@/navigation/types";
import { ExamPartGuidePage } from "@/screens/mock-exam/components/ExamPartGuidePage";
import { colors } from "@/theme";

type ExamPartGuideScreenProps = NativeStackScreenProps<MockExamStackParamList, "ExamPartGuide">;

export function ExamPartGuideScreen({ navigation }: ExamPartGuideScreenProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const previousWidthRef = useRef(width);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (previousWidthRef.current === width) return;

    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: false });
    previousWidthRef.current = width;
  }, [activeIndex, width]);

  const handleSelectPart = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  };

  const handleNext = () => {
    const nextIndex = activeIndex + 1;
    handleSelectPart(nextIndex);
  };

  const handleStartExam = () => {
    // TODO: 시험 진행 화면이 추가되면 createExamSession() 결과와 함께 해당 라우트로 이동한다.
    console.log("[ExamPartGuide] 시작하기 press");
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <View className="h-16 flex-row items-center px-5">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="flex-1 pr-10 text-center text-2xl">모의고사 시작</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
        }}
      >
        {EXAM_PART_GUIDES.map((guide, index) => (
          <View key={guide.part} style={{ width }}>
            <ExamPartGuidePage
              activeIndex={index}
              guide={guide}
              isLast={index === EXAM_PART_GUIDES.length - 1}
              partCount={EXAM_PART_GUIDES.length}
              onNext={handleNext}
              onSelectPart={handleSelectPart}
              onStart={handleStartExam}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
