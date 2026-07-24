import { Image, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { getExamPartMeta } from "@/features/exam/part-meta";
import type { ExamQuestion, ExamTableContext } from "@/types/exam";

function ExamInformationTable({ context }: { context: ExamTableContext }) {
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

export function ExamQuestionContent({ question }: { question: ExamQuestion }) {
  const partMeta = getExamPartMeta(question.partNumber);

  return (
    <View className="items-center gap-4">
      <View className="rounded-full bg-brand-50 px-3 py-1">
        <Text className="text-sm text-brand-text">
          Part {question.partNumber} · {partMeta.titleEn}
        </Text>
      </View>

      {question.referenceText ? (
        <View className="w-full rounded-2xl bg-brand-50 px-5 py-4">
          <Text className="text-left text-lg leading-8 text-exam-navy">
            {question.referenceText}
          </Text>
        </View>
      ) : null}

      {question.imageUrl ? (
        <View className="aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface-muted">
          <Image
            accessibilityLabel="문제 사진"
            className="h-full w-full"
            resizeMode="cover"
            source={{ uri: question.imageUrl }}
          />
        </View>
      ) : null}

      {question.tableContext ? <ExamInformationTable context={question.tableContext} /> : null}

      {question.question && question.partNumber !== 4 ? (
        <Text className="text-center text-xl leading-8 text-exam-navy">{question.question}</Text>
      ) : null}
    </View>
  );
}
