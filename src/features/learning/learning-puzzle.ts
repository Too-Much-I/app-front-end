import type { LearningSentence } from '@/types/learning';

export interface PuzzlePiece {
  /** 문장 안 순서. 0부터. */
  order: number;
  words: string[];
}

/**
 * 서버가 조각을 주지 않은 문장에서 쓰는 조각 길이.
 * 2026-10-19 조각 기준(2~7단어, 의미 우선)의 가운데 값이다. 의미 경계는 모르므로 임시다.
 */
const FALLBACK_PIECE_WORDS = 3;

/** 문장을 퍼즐 조각으로 나눈다. `chunks`가 없으면 단어 수로 자른다. */
export function buildPuzzlePieces(sentence: LearningSentence): PuzzlePiece[] {
  const words = sentence.words.map((word) => word.text);
  const ranges =
    sentence.chunks ??
    Array.from({ length: Math.ceil(words.length / FALLBACK_PIECE_WORDS) }, (_, index) => ({
      from: index * FALLBACK_PIECE_WORDS,
      to: Math.min((index + 1) * FALLBACK_PIECE_WORDS, words.length) - 1,
    }));

  return ranges.map((range, order) => ({ order, words: words.slice(range.from, range.to + 1) }));
}

/**
 * 남은 조각을 흩어 놓을 순서. 같은 문장은 늘 같은 순서로 섞는다(다시 그릴 때마다 바뀌면 손이 헷갈린다).
 * 조각이 둘 이상이면 정답 순서 그대로 놓이지 않게 한다.
 */
export function scatterPuzzlePieces(pieces: readonly PuzzlePiece[]): PuzzlePiece[] {
  if (pieces.length < 2) return [...pieces];
  // 짝수 자리와 홀수 자리를 뒤에서부터 번갈아 꺼내면 첫 조각이 맨 앞에 오지 않는다.
  const reversed = [...pieces].reverse();
  return [
    ...reversed.filter((_, index) => index % 2 === 0),
    ...reversed.filter((_, index) => index % 2 === 1),
  ];
}

export type PuzzlePress = 'placed' | 'completed' | 'wrong';

/** 조각을 눌렀을 때의 결과. 순서대로만 붙는다. */
export function pressPuzzlePiece(
  placedCount: number,
  pieceCount: number,
  pressedOrder: number,
): PuzzlePress {
  if (pressedOrder !== placedCount) return 'wrong';
  return placedCount + 1 === pieceCount ? 'completed' : 'placed';
}
