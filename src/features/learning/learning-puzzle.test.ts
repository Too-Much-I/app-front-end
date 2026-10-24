import {
  buildPuzzlePieces,
  pressPuzzlePiece,
  scatterPuzzlePieces,
} from '@/features/learning/learning-puzzle';
import type { LearningSentence } from '@/types/learning';

function sentence(text: string, chunks: LearningSentence['chunks']): LearningSentence {
  return {
    text,
    translation: null,
    words: text.split(' ').map((word, index) => ({ text: word, start: index, end: index })),
    audio: null,
    chunks,
  };
}

describe('buildPuzzlePieces', () => {
  it('chunks 범위대로 자른다(to 포함)', () => {
    const pieces = buildPuzzlePieces(
      sentence('I would be more likely to attend the event.', [
        { from: 0, to: 4 },
        { from: 5, to: 8 },
      ]),
    );

    expect(pieces.map((piece) => piece.words.join(' '))).toEqual([
      'I would be more likely',
      'to attend the event.',
    ]);
  });

  it('chunks가 없으면 세 단어씩 자른다', () => {
    const pieces = buildPuzzlePieces(sentence('a b c d e f g', null));

    expect(pieces.map((piece) => piece.words.join(' '))).toEqual(['a b c', 'd e f', 'g']);
  });
});

describe('scatterPuzzlePieces', () => {
  it('조각이 둘 이상이면 첫 조각이 맨 앞에 오지 않는다', () => {
    const pieces = buildPuzzlePieces(sentence('a b c d e f g h i', null));

    expect(scatterPuzzlePieces(pieces)[0]?.order).not.toBe(0);
    expect(scatterPuzzlePieces(pieces)).toHaveLength(pieces.length);
  });
});

describe('pressPuzzlePiece', () => {
  it('다음 차례 조각만 붙고 마지막 조각이면 completed', () => {
    expect(pressPuzzlePiece(0, 3, 1)).toBe('wrong');
    expect(pressPuzzlePiece(0, 3, 0)).toBe('placed');
    expect(pressPuzzlePiece(2, 3, 2)).toBe('completed');
  });
});
