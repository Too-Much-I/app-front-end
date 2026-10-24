import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { PuzzlePiece } from '@/features/learning/learning-puzzle';
import { puzzlePieceColor } from '@/screens/learning/puzzle-piece-color';
import { colors, duration } from '@/theme';

/** 흩어진 조각의 기울기. 같은 값이 반복되면 줄 세운 것처럼 보여 조각마다 다르게 준다. */
const TILTS = ['-4deg', '3deg', '-2deg', '4deg', '-3deg'];
/** 틀린 조각을 흔드는 폭(px). 결정 기록의 0.42초 좌우 흔들림을 네 번 왕복으로 나눴다. */
const SHAKE_OFFSET = 8;
const SHAKE_STEP_MS = 105;

interface PuzzleTrayPieceProps {
  piece: PuzzlePiece;
  slotIndex: number;
  /** 틀리게 누를 때마다 늘어나는 값. 바뀌면 한 번 흔든다. */
  shakeSignal: number;
  /** 틀린 뒤 다음에 놓을 조각을 반짝이게 한다. */
  hinted: boolean;
  onPress: () => void;
}

/** 아래에 흩어져 있는 남은 조각 하나. */
export function PuzzleTrayPiece({
  piece,
  slotIndex,
  shakeSignal,
  hinted,
  onPress,
}: PuzzleTrayPieceProps) {
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeSignal === 0) return;
    Animated.sequence(
      [SHAKE_OFFSET, -SHAKE_OFFSET, SHAKE_OFFSET / 2, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: SHAKE_STEP_MS, useNativeDriver: true }),
      ),
    ).start();
  }, [shake, shakeSignal]);

  useEffect(() => {
    if (!hinted) {
      glow.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: duration.loop, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.3, duration: duration.loop, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, hinted]);

  const label = piece.words.join(' ');

  return (
    <Animated.View
      style={{
        transform: [{ translateX: shake }, { rotate: TILTS[slotIndex % TILTS.length] ?? '0deg' }],
      }}
    >
      <Pressable accessibilityLabel={`조각 ${label}`} accessibilityRole="button" onPress={onPress}>
        <Animated.View
          className="min-h-12 justify-center rounded-chip border-4 px-lg"
          style={{
            backgroundColor: puzzlePieceColor(piece.order),
            borderColor: glow.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', colors.learningPuzzle.hint],
            }),
          }}
        >
          <Text className="text-base" style={{ color: colors.learningPuzzle.ink }}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
