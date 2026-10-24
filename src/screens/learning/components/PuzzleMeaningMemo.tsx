import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, shadows } from '@/theme';

/** 모눈 한 칸 크기(px). */
const GRID_SIZE = 18;

interface PuzzleMeaningMemoProps {
  text: string;
}

/**
 * 맞출 문장의 한국어 뜻을 적어 둔 모눈 메모지.
 *
 * 모눈은 메모지 크기를 재서 가로·세로 선을 칸 수만큼 그린다. 글자 길이에 따라 높이가 바뀌기 때문이다.
 */
export function PuzzleMeaningMemo({ text }: PuzzleMeaningMemoProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const columns = Math.floor(size.width / GRID_SIZE);
  const rows = Math.floor(size.height / GRID_SIZE);

  return (
    <View>
      <View
        className="overflow-hidden rounded-card"
        style={[shadows.card, { backgroundColor: colors.learningPuzzle.memo }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        {Array.from({ length: columns }, (_, index) => (
          <View
            key={`column-${index}`}
            className="absolute bottom-0 top-0 w-px"
            style={{
              left: (index + 1) * GRID_SIZE,
              backgroundColor: colors.learningPuzzle.memoGrid,
            }}
          />
        ))}
        {Array.from({ length: rows }, (_, index) => (
          <View
            key={`row-${index}`}
            className="absolute left-0 right-0 h-px"
            style={{
              top: (index + 1) * GRID_SIZE,
              backgroundColor: colors.learningPuzzle.memoGrid,
            }}
          />
        ))}
        <Text className="px-lg py-xl text-lg" style={{ color: colors.learningPuzzle.ink }}>
          {text}
        </Text>
      </View>
      {/* 테이프 조각. 메모지를 붙여 둔 느낌을 준다. */}
      <View
        className="absolute -top-2 left-1/2 h-5 w-16 -ml-8"
        style={{
          backgroundColor: colors.learningPuzzle.hint,
          opacity: 0.85,
          transform: [{ rotate: '-4deg' }],
        }}
      />
    </View>
  );
}
