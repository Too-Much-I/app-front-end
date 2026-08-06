import { Image, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { getExamPartMeta } from "@/features/exam/part-meta";
import { ExamInformationImage } from "@/screens/mock-exam/components/ExamInformationImage";
import type { ExamQuestion } from "@/types/exam";

export function ExamQuestionContent({ question }: { question: ExamQuestion }) {
  const partMeta = getExamPartMeta(question.partNumber);

  return (
    <View className="items-center gap-4">
      <View className="rounded-full bg-surface-muted px-3 py-1">
        <Text className="text-sm text-brand-text">
          Part {question.partNumber} · {partMeta.titleEn}
        </Text>
      </View>

      {question.referenceText ? (
        <View className="w-full rounded-2xl border border-line bg-surface px-5 py-4">
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

      {question.tableImageUrl ? (
        <ExamInformationImage imageUrl={question.tableImageUrl} />
      ) : null}

      {question.question && question.partNumber !== 4 ? (
        <Text className="text-center text-xl leading-8 text-exam-navy">{question.question}</Text>
      ) : null}
    </View>
  );
}
