/** Only split explicit comma-separated choices, never paraphrase the question. */
export function getLearningQuestionLayout(question: string) {
  const match = question.match(/^(Which[^:]+:)\s+([^?]+\?)\s*(.*)$/i);
  if (!match) return null;
  const choices = match[2].replace(/\?$/, '').split(/,\s*(?:or\s+)?|\s+or\s+/);
  if (choices.length < 2 || choices.length > 4 || choices.some((c) => c.length > 100)) return null;
  return { prompt: match[1], choices, instruction: match[3] };
}
