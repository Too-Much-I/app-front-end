import { ScrollView, View } from "react-native";

import { ExamInformationTable } from "@/screens/mock-exam/components/ExamInformationTable";
import type { ExamPartReadingPrelude } from "@/types/exam";

interface ExamInformationReadingProps {
  prelude: ExamPartReadingPrelude;
  onTableVisible: () => void;
}

export function ExamInformationReading({
  prelude,
  onTableVisible,
}: ExamInformationReadingProps) {
  return (
    <ScrollView
      bounces={false}
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="mx-auto w-full max-w-3xl" onLayout={onTableVisible}>
        <ExamInformationTable context={prelude.tableContext} />
      </View>
    </ScrollView>
  );
}
