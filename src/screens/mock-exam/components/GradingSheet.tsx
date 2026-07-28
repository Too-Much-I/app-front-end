import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";

import { Text } from "@/components/ui/Text";
import { GRADING_PART_COUNT } from "@/features/exam/use-grading-status";
import { getExamPartMeta } from "@/features/exam/part-meta";
import { RedPenCheck } from "@/screens/mock-exam/components/RedPenCheck";
import { colors, shadows } from "@/theme";

/** 한 줄의 높이. 괘선 간격이자 파트 한 줄의 높이다. */
const ROW_HEIGHT = 44;
/** 왼쪽 여백선까지의 너비. 체크는 이 안쪽(선생님 자리)에 들어간다. */
const MARGIN_WIDTH = 44;
const CHECK_SIZE = 26;
/** 줄마다 다르게 주는 기울기. 같은 값이 반복되면 도장처럼 보인다. */
const CHECK_TILTS = [-7, 5, -4, 6, -6];

interface SheetRowProps {
  children: React.ReactNode;
  /** 여백선 왼쪽에 들어가는 자국. */
  mark?: React.ReactNode;
}

/**
 * 여백 칸과 본문 칸으로 나뉜 한 줄.
 *
 * 여백을 padding이 아니라 고정 폭 View로 잡는 이유: 절대 배치한 자식의 기준이
 * 부모의 padding을 포함하는지가 Yoga 버전에 따라 갈린다. 칸을 실제로 나눠 두면
 * 그 차이와 무관하게 체크가 항상 여백선 왼쪽에 온다.
 */
function SheetRow({ children, mark }: SheetRowProps) {
  return (
    <View
      className="flex-row items-center border-b pr-4"
      style={{ height: ROW_HEIGHT, borderBottomColor: colors.grading.rule }}
    >
      <View className="items-center justify-center" style={{ width: MARGIN_WIDTH }}>
        {mark}
      </View>
      <View className="flex-1 pl-3">{children}</View>
    </View>
  );
}

interface GradingSheetProps {
  /** 채점이 끝난 파트 수. 이 다음 줄이 "지금 채점 중"인 줄이 된다. */
  gradedPartCount: number;
}

/**
 * 줄 쳐진 답안지 위의 채점표.
 *
 * 진행률 숫자도 남은 시간도 없는 화면이라, 진행 상황은 이 종이 위에서만 드러난다.
 * 파트가 끝날 때마다 여백에 체크가 그어지고, 채점 중인 줄에는 펜이 머문다.
 */
export function GradingSheet({ gradedPartCount }: GradingSheetProps) {
  const [bodyHeight, setBodyHeight] = useState(0);
  const parts = Array.from({ length: GRADING_PART_COUNT }, (_, index) => index + 1);

  // 목록이 끝난 뒤에도 괘선을 종이 끝까지 잇는다. 아래쪽이 빈 여백으로 남으면
  // 종이가 아니라 잘린 카드로 보인다. 넘치는 만큼은 종이가 잘라낸다(overflow-hidden).
  const filledHeight = parts.length * ROW_HEIGHT;
  const fillerCount = Math.max(0, Math.ceil((bodyHeight - filledHeight) / ROW_HEIGHT));

  const handleBodyLayout = (event: LayoutChangeEvent) => {
    setBodyHeight(event.nativeEvent.layout.height);
  };

  return (
    // 그림자와 overflow-hidden을 한 View에 같이 주면 iOS에서 그림자가 잘려 사라진다.
    // 바깥은 그림자만, 안쪽은 종이(배경·테두리·클리핑)만 맡는다.
    <View
      accessible
      accessibilityLabel={`채점 진행, ${GRADING_PART_COUNT}개 중 ${gradedPartCount}개 완료`}
      accessibilityLiveRegion="polite"
      className="flex-1 rounded"
      style={shadows.card}
    >
      <View
        className="flex-1 overflow-hidden rounded border"
        style={{
          backgroundColor: colors.grading.paper,
          borderColor: colors.grading.paperEdge,
        }}
      >
        {/* 왼쪽 세로 여백선 — 종이 위아래를 관통한다 */}
        <View
          className="absolute bottom-0 top-0"
          style={{ left: MARGIN_WIDTH, width: 1, backgroundColor: colors.grading.margin }}
        />

        <View
          className="flex-row items-center border-b py-3 pr-4"
          style={{ borderBottomColor: colors.grading.rule }}
        >
          <View style={{ width: MARGIN_WIDTH }} />
          <View className="flex-1 flex-row items-baseline justify-between pl-3">
            <Text className="text-base">채점표</Text>
            {/* 이 화면에서 유일한 수치 단서라 빼지 않는다 */}
            <Text className="text-xs text-ink-disabled">
              {GRADING_PART_COUNT}개 중 {gradedPartCount}개 완료
            </Text>
          </View>
        </View>

        <View className="flex-1" onLayout={handleBodyLayout}>
          {parts.map((partNumber, index) => {
            const isGraded = index < gradedPartCount;
            const isGrading = index === gradedPartCount;

            return (
              <SheetRow
                key={partNumber}
                mark={
                  isGraded ? (
                    <RedPenCheck size={CHECK_SIZE} tiltDegrees={CHECK_TILTS[index] ?? 0} />
                  ) : isGrading ? (
                    <MaterialCommunityIcons
                      name="lead-pencil"
                      size={20}
                      color={colors.grading.ink}
                      style={{ transform: [{ rotate: "-8deg" }] }}
                    />
                  ) : null
                }
              >
                {/* 밑줄이 글자 너비에만 깔리도록 self-start로 폭을 글자에 맞춘다 */}
                <View className="self-start">
                  <Text
                    className={`text-base ${isGraded || isGrading ? "text-ink" : "text-ink-disabled"}`}
                    numberOfLines={1}
                  >
                    파트 {partNumber} · {getExamPartMeta(partNumber).titleKo}
                  </Text>
                  {/* 채점 중인 줄에만 남는 밑줄 — 펜이 지금 이 줄에 있다는 표시 */}
                  {isGrading ? (
                    <View
                      className="rounded-full"
                      style={{
                        marginTop: 2,
                        height: 2,
                        backgroundColor: colors.grading.ink,
                      }}
                    />
                  ) : null}
                </View>
              </SheetRow>
            );
          })}

          {Array.from({ length: fillerCount }, (_, index) => (
            <SheetRow key={`filler-${index}`}>{null}</SheetRow>
          ))}
        </View>
      </View>
    </View>
  );
}
