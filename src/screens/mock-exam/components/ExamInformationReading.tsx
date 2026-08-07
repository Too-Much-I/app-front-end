import { ScrollView, View } from "react-native";

import { Part4Table } from "@/components/exam/Part4Table";
import type { ExamPartReadingPrelude } from "@/types/exam";

interface ExamInformationReadingProps {
  prelude: ExamPartReadingPrelude;
  onTableReady: () => void;
}

export function ExamInformationReading({
  prelude,
  onTableReady,
}: ExamInformationReadingProps) {
  return (
    <ScrollView
      bounces={false}
      className="flex-1 bg-surface"
      contentContainerClassName="flex-grow justify-center px-6 py-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="mx-auto w-full max-w-3xl">
        <Part4Table table={prelude.tableContext} onReady={onTableReady} />
      </View>
    </ScrollView>
  );
}
