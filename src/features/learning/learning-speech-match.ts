const SMALL = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function numberWords(value: number): string {
  if (value < 20) return SMALL[value];
  if (value < 100) return `${TENS[Math.floor(value / 10)]} ${value % 10 ? SMALL[value % 10] : ''}`;
  if (value < 1000)
    return `${SMALL[Math.floor(value / 100)]} hundred ${value % 100 ? numberWords(value % 100) : ''}`;
  if (value < 10000)
    return `${SMALL[Math.floor(value / 1000)]} thousand ${value % 1000 ? numberWords(value % 1000) : ''}`;
  return String(value);
}
const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "i've": 'i have',
  "we've": 'we have',
  "i'll": 'i will',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "can't": 'cannot',
  "won't": 'will not',
  "couldn't": 'could not',
};
function canonicalWords(word: string): string[] {
  let value = word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[.,!?;]+$/g, '');
  value = CONTRACTIONS[value] ?? value;
  value = value
    .replace(/\$(\d+)/g, (_, n: string) => `${numberWords(Number(n))} dollars`)
    .replace(
      /(\d{1,2}):(\d{2})/g,
      (_, h: string, m: string) =>
        `${numberWords(Number(h))} ${Number(m) ? `${Number(m) < 10 ? 'oh ' : ''}${numberWords(Number(m))}` : ''}`,
    )
    .replace(/\b\d+\b/g, (n) => numberWords(Number(n)))
    .replace(/\ba\.?m\.?\b/g, 'a m')
    .replace(/\bp\.?m\.?\b/g, 'p m')
    .replace(/\bo'clock\b/g, '')
    .replace(/[^a-z0-9'\s]/g, ' ');
  return value.split(/\s+/).filter(Boolean);
}

/** Ordered matching: a repeated spoken word cannot fill several expected words. */
export function matchLearningSpeech(expected: string, transcript: string) {
  return matchSpeechWords(expected, transcript, [], false);
}

/** Shadowing lets learners return to a missed word, while each heard token counts only once. */
export function matchLearningSpeechAttempt(
  expected: string,
  transcript: string,
  confirmed: readonly boolean[] = [],
) {
  return matchSpeechWords(expected, transcript, confirmed, true);
}

function matchSpeechWords(
  expected: string,
  transcript: string,
  confirmed: readonly boolean[],
  allowRepairs: boolean,
) {
  const words = expected.trim().split(/\s+/).filter(Boolean);
  const tokensByWord = words.map(canonicalWords);
  const target = tokensByWord.flatMap((tokens, index) =>
    confirmed[index] ? [] : tokens.map((value) => ({ value, index })),
  );
  const heard = transcript.split(/\s+/).flatMap(canonicalWords);
  const matrix = Array.from({ length: target.length + 1 }, () => new Uint16Array(heard.length + 1));
  for (let i = target.length - 1; i >= 0; i--)
    for (let j = heard.length - 1; j >= 0; j--) {
      matrix[i][j] =
        target[i].value === heard[j]
          ? matrix[i + 1][j + 1] + 1
          : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  const hits = new Set<number>();
  const heardHits = new Set<number>();
  // Start at the beginning so partial speech lights the first repeated word, not the last.
  let i = 0,
    j = 0;
  while (i < target.length && j < heard.length) {
    if (target[i].value === heard[j]) {
      hits.add(i);
      heardHits.add(j);
      i++;
      j++;
    } else if (matrix[i + 1][j] > matrix[i][j + 1]) i++;
    else j++;
  }
  if (allowRepairs) {
    // A correction after the sentence ("... room. craft.") can fill an earlier hole.
    // Used transcript tokens are excluded, so repeated target words still need separate speech.
    target.forEach((token, index) => {
      if (hits.has(index)) return;
      const spoken = heard.findIndex((value, k) => value === token.value && !heardHits.has(k));
      if (spoken < 0) return;
      hits.add(index);
      heardHits.add(spoken);
    });
  }
  const matched = words.map(
    (_, index) =>
      tokensByWord[index].length > 0 &&
      (confirmed[index] === true ||
        target.every((token, k) => token.index !== index || hits.has(k))),
  );
  const wordCount = tokensByWord.filter((tokens) => tokens.length > 0).length;
  const matchedCount = matched.filter(Boolean).length;
  // Use displayed words so a contraction/number does not carry extra weight.
  const ratio = wordCount > 0 ? matchedCount / wordCount : 0;
  return {
    words,
    matched,
    ratio,
    complete: ratio >= 0.7,
    fullyMatched: wordCount > 0 && matchedCount === wordCount,
  };
}

const FUNCTION_WORDS = new Set(
  'a an the i my we our you your he she it they their is are am was were be do does did have has of in on at to for from by with and or but so as if'.split(
    ' ',
  ),
);
export function getLearningHiddenWords(text: string, round: number): Set<number> {
  const words = text.split(/\s+/);
  if (round === 0) return new Set();
  if (round === 2) return new Set(words.map((_, i) => i));
  const ranked = words
    .map((word, index) => ({ word, index }))
    .filter((x) => x.index > 0)
    .sort(
      (a, b) =>
        Number(FUNCTION_WORDS.has(a.word.toLowerCase())) -
          Number(FUNCTION_WORDS.has(b.word.toLowerCase())) || a.index - b.index,
    );
  return new Set(ranked.slice(0, Math.ceil(words.length * 0.45)).map((x) => x.index));
}
