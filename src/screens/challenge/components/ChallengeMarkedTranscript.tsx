import type { ReactNode } from "react";

import { Text } from "@/components/ui/Text";
import {
  type ChallengeCorrectionSpan,
  getCorrectionSeverityColor,
} from "@/screens/challenge/challenge-corrections";
import type { ChallengeCorrectionItem } from "@/types/challenge";

interface ChallengeMarkedTranscriptProps {
  transcript: string;
  corrections: ChallengeCorrectionItem[];
  /** `findCorrectionSpans`가 찾은 밑줄 자리. 화면이 계산해 넘긴다. */
  spans: ChallengeCorrectionSpan[];
  /** 밑줄을 누르면 그 항목의 인덱스를 준다. 시트를 여는 쪽은 화면이다. */
  onSelect: (index: number) => void;
}

/**
 * 내가 말한 문장에 첨삭 밑줄을 긋는다.
 *
 * 한 `Text` 안에 조각을 이어 붙인다 — 조각마다 `View`를 쓰면 줄바꿈이 문장 단위로
 * 끊겨 단어 중간에서 줄이 넘어가지 않는다. 중첩된 `Text`는 부모의 글꼴과 줄 간격을
 * 그대로 물려받으므로 밑줄이 있는 조각만 색과 장식을 더한다.
 *
 * 밑줄 색과 **글자 색**을 함께 바꾸는 이유는 RN의 `textDecorationColor`가 iOS 전용이기
 * 때문이다. 안드로이드는 그 값을 무시하고 글자 색으로 밑줄을 그어서, 색을 글자에 주지
 * 않으면 두 플랫폼에서 다른 색의 밑줄이 나온다.
 */
export function ChallengeMarkedTranscript({
  transcript,
  corrections,
  spans,
  onSelect,
}: ChallengeMarkedTranscriptProps) {
  const pieces: ReactNode[] = [];
  let cursor = 0;

  for (const span of spans) {
    const correction = corrections[span.index];
    if (!correction) continue;

    if (span.start > cursor) {
      pieces.push(transcript.slice(cursor, span.start));
    }

    pieces.push(
      <Text
        accessibilityHint="첨삭 설명을 엽니다"
        accessibilityLabel={`${correction.original} — ${correction.issue}`}
        accessibilityRole="button"
        key={`${span.index}-${span.start}`}
        onPress={() => onSelect(span.index)}
        style={{
          color: getCorrectionSeverityColor(correction.severity),
          textDecorationLine: "underline",
        }}
      >
        {transcript.slice(span.start, span.end)}
      </Text>,
    );
    cursor = span.end;
  }

  if (cursor < transcript.length) {
    pieces.push(transcript.slice(cursor));
  }

  return <Text className="mt-2 text-lg leading-8">{pieces}</Text>;
}
