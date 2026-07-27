import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import type { ExamTableContext } from "@/types/exam";

export function ExamInformationTable({ context }: { context: ExamTableContext }) {
  return (
    <View className="w-full overflow-hidden rounded-2xl border border-line bg-surface">
      <View className="border-b border-line bg-surface-muted px-4 py-3">
        <Text className="text-lg text-exam-navy">{context.title}</Text>
        <Text className="mt-0.5 text-xs leading-5 text-ink-muted">
          {context.location} · {context.date} · Fee: {context.fee}
        </Text>
      </View>

      {context.items.map((item, index) => (
        <View
          key={`${item.time}-${index}`}
          className={`flex-row items-start px-4 py-2.5 ${
            index < context.items.length - 1 ? "border-b border-line" : ""
          }`}
        >
          <Text className="w-16 text-sm text-ink-muted">{item.time}</Text>
          <View className="flex-1 px-2">
            <Text className="text-sm leading-5">{item.sessionTitle}</Text>
            {item.note ? <Text className="text-xs text-ink-disabled">({item.note})</Text> : null}
          </View>
          <Text className="max-w-24 text-right text-xs leading-5 text-ink-muted">
            {item.speaker ?? ""}
          </Text>
        </View>
      ))}
    </View>
  );
}
