import { ScrollView, View } from "react-native";

import { ExamInformationImage } from "@/screens/mock-exam/components/ExamInformationImage";
import type { ExamPartReadingPrelude } from "@/types/exam";

interface ExamInformationReadingProps {
  prelude: ExamPartReadingPrelude;
  onImageLoad: () => void;
}

export function ExamInformationReading({
  prelude,
  onImageLoad,
}: ExamInformationReadingProps) {
  return (
    <ScrollView
      bounces={false}
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="mx-auto w-full max-w-3xl">
        <ExamInformationImage imageUrl={prelude.tableImageUrl} onLoad={onImageLoad} />
      </View>
    </ScrollView>
  );
}
