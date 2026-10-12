import { matchLearningSpeech } from '@/features/learning/learning-speech-match';
import { LearningWordBoxes } from '@/screens/learning/LearningWordBoxes';

export function LearningSpeechFeedback({
  text,
  transcript,
  hidden,
  showInitials = false,
  recognized,
}: {
  text: string;
  transcript: string;
  hidden: ReadonlySet<number>;
  showInitials?: boolean;
  recognized?: readonly boolean[];
}) {
  const match = matchLearningSpeech(text, transcript);
  const matched = recognized ?? match.matched;
  return (
    <LearningWordBoxes
      words={match.words}
      states={match.words.map((_, index) => (matched[index] ? 'complete' : 'pending'))}
      hidden={hidden}
      showInitials={showInitials}
      accessibilityLabel={match.words
        .map((word, index) =>
          matched[index]
            ? `${word}, 인식됨`
            : hidden.has(index)
              ? showInitials
                ? `${word.match(/[a-z0-9]/i)?.[0] ?? ''}로 시작하는 빈칸`
                : '빈칸'
              : word,
        )
        .join(' ')}
    />
  );
}
