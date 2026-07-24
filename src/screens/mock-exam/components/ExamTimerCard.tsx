import { View } from "react-native";

import { Text } from "@/components/ui/Text";

export type ExamTimerMode = "preparation" | "response";

interface ExamTimerCardProps {
  mode: ExamTimerMode;
  remainingSeconds: number;
}

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/** 웹 시험 화면의 2단 타이머를 RN View로 그대로 재구성한다. */
export function ExamTimerCard({ mode, remainingSeconds }: ExamTimerCardProps) {
  const isResponse = mode === "response";
  const label = isResponse ? "RESPONSE TIME" : "PREPARATION TIME";

  return (
    <View
      accessibilityLabel={`${isResponse ? "답변" : "준비"} 시간 ${formatSeconds(remainingSeconds)}`}
      className="w-60 items-stretch"
    >
      <View className="rounded-t-xl bg-exam-navy py-2">
        <Text className="text-center text-sm tracking-widest text-white">{label}</Text>
      </View>
      <View
        className={`rounded-b-xl border-2 border-t-0 bg-surface py-2.5 ${
          isResponse ? "border-exam-dangerLine" : "border-exam-navy"
        }`}
      >
        <Text
          className={`text-center text-3xl tabular-nums ${
            isResponse ? "text-exam-danger" : "text-exam-navy"
          }`}
        >
          {formatSeconds(remainingSeconds)}
        </Text>
      </View>
    </View>
  );
}
