import { colors } from '@/theme';

/** 조각 색. 순서대로 돌려 쓰고 정답·오답 의미는 없다. 판과 남은 조각이 같은 색이어야 같은 조각으로 읽힌다. */
export function puzzlePieceColor(order: number) {
  const palette = colors.learningPuzzle.pieces;
  return palette[order % palette.length] ?? palette[0];
}
