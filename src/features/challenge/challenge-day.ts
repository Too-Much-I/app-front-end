/**
 * 하루치 챌린지의 고정된 사실.
 *
 * 오늘 진행도 응답에는 `totalQuestionCount`가 있지만 월별 이력에는 없다. 명세 §1이
 * "하루에 3문제"를 계약으로 정했으므로, 이력만 가진 화면(달력·지난 날짜 스테이지)은 이 값을 쓴다.
 */
export const CHALLENGE_QUESTIONS_PER_DAY = 3;

/** `YYYY-MM-DD` → `10월 4일`. 날짜 문자열을 그대로 읽어 기기 시간대에 흔들리지 않는다. */
export function formatChallengeDateLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${month}월 ${day}일`;
}
