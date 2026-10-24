import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import type { PuzzlePiece } from '@/features/learning/learning-puzzle';
import { puzzlePieceColor } from '@/screens/learning/puzzle-piece-color';
import { colors, duration, easings, spacing } from '@/theme';

/** 조각 높이와 이음매 꼭지. 2026-10-19 시안 값(높이 46, 꼭지 원)을 옮겼다. */
const PIECE_HEIGHT = 46;
const TAB_SIZE = 16;
const PIECE_RADIUS = 12;
/** 꼭지가 다음 조각 글자를 덮지 않게 다음 조각 첫 단어 앞을 이만큼 더 띄운다. */
const TAB_CLEARANCE = TAB_SIZE / 2 + 6;

interface PuzzleBoardProps {
  pieces: readonly PuzzlePiece[];
  placedCount: number;
}

/**
 * 맞춘 조각이 문장처럼 이어지는 판.
 *
 * 조각을 통째 상자로 두지 않고 **단어마다 따로** 줄에 놓는다. 그래야 줄 끝에 닿은 조각이 단어 사이에서
 * 갈라져 다음 줄로 이어진다(2026-10-19 결정). 같은 조각의 단어는 같은 색으로 붙여 그려 한 조각으로 보이게 하고,
 * 조각 끝 단어에 꼭지를 달아 다음 조각과 맞물린 것처럼 보이게 한다.
 */
export function PuzzleBoard({ pieces, placedCount }: PuzzleBoardProps) {
  const completed = placedCount === pieces.length;
  const placed = pieces.slice(0, placedCount);

  return (
    <View
      className="min-h-36 flex-row flex-wrap content-start rounded-card p-lg"
      style={{
        backgroundColor: completed ? colors.learningPuzzle.boardDone : colors.learningPuzzle.board,
        rowGap: spacing.md,
      }}
    >
      {placed.flatMap((piece) =>
        piece.words.map((word, wordIndex) => (
          <PuzzleWord
            key={`${piece.order}-${wordIndex}`}
            color={puzzlePieceColor(piece.order)}
            isPieceStart={wordIndex === 0}
            isPieceEnd={wordIndex === piece.words.length - 1}
            isSentenceStart={piece.order === 0 && wordIndex === 0}
            isSentenceEnd={
              completed && piece.order === pieces.length - 1 && wordIndex === piece.words.length - 1
            }
            pieceOrder={piece.order}
            text={word}
          />
        )),
      )}
      {completed ? null : <NextSlot isFirst={placedCount === 0} />}
    </View>
  );
}

interface PuzzleWordProps {
  text: string;
  color: string;
  pieceOrder: number;
  isPieceStart: boolean;
  isPieceEnd: boolean;
  isSentenceStart: boolean;
  isSentenceEnd: boolean;
}

/** 판 위 단어 하나. 처음 놓일 때 한 번 밝아지며 나타난다. */
function PuzzleWord({
  text,
  color,
  pieceOrder,
  isPieceStart,
  isPieceEnd,
  isSentenceStart,
  isSentenceEnd,
}: PuzzleWordProps) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: duration.base,
      easing: easings.decelerate,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const showTab = isPieceEnd && !isSentenceEnd;

  return (
    <Animated.View
      className="justify-center"
      style={{
        height: PIECE_HEIGHT,
        backgroundColor: color,
        paddingLeft: isPieceStart ? (pieceOrder === 0 ? 14 : TAB_CLEARANCE) : 3,
        // 같은 조각의 단어끼리 1px 겹쳐 그린다. 딱 붙이면 Android에서 경계에 가는 세로줄이 보인다.
        marginLeft: isPieceStart ? 0 : -1,
        paddingRight: isPieceEnd ? 10 : 3,
        borderTopLeftRadius: isSentenceStart ? PIECE_RADIUS : 0,
        borderBottomLeftRadius: isSentenceStart ? PIECE_RADIUS : 0,
        borderTopRightRadius: isSentenceEnd ? PIECE_RADIUS : 0,
        borderBottomRightRadius: isSentenceEnd ? PIECE_RADIUS : 0,
        // 앞 조각의 꼭지가 뒤 조각 위로 올라와야 맞물려 보인다.
        zIndex: 100 - pieceOrder,
        opacity: appear,
        transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
      }}
    >
      <Text className="text-base" style={{ color: colors.learningPuzzle.ink }}>
        {text}
      </Text>
      {showTab ? (
        <View
          className="absolute rounded-full"
          style={{
            width: TAB_SIZE,
            height: TAB_SIZE,
            right: -TAB_SIZE / 2,
            top: (PIECE_HEIGHT - TAB_SIZE) / 2,
            backgroundColor: color,
          }}
        />
      ) : null}
    </Animated.View>
  );
}

/** 다음 조각이 들어갈 점선 칸. 천천히 깜빡여 여기에 놓인다는 걸 알린다. */
function NextSlot({ isFirst }: { isFirst: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: duration.loop, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: duration.loop, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityLabel="다음 조각 자리"
      className="w-24 border-2 border-dashed"
      style={{
        height: PIECE_HEIGHT,
        borderColor: colors.learningPuzzle.slot,
        borderLeftWidth: isFirst ? 2 : 0,
        borderTopLeftRadius: isFirst ? PIECE_RADIUS : 0,
        borderBottomLeftRadius: isFirst ? PIECE_RADIUS : 0,
        borderTopRightRadius: PIECE_RADIUS,
        borderBottomRightRadius: PIECE_RADIUS,
        opacity: pulse,
      }}
    />
  );
}
