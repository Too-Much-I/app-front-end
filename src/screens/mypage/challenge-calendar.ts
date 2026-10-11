import type { ChallengeHistory } from '@/types/challenge';

/**
 * 마이페이지 달력이 그리는 칸과 그 판정.
 *
 * 날짜는 서버가 준 `YYYY-MM-DD` 문자열끼리 비교한다. 기기 시계로 오늘을 만들지 않는다 —
 * 오늘은 이번 달 이력의 마지막 날짜다(이번 달은 KST 오늘까지만 온다).
 */

const DAYS_PER_WEEK = 7;

export type ChallengeCalendarDay =
  /** 달의 1일 앞, 말일 뒤를 채우는 빈칸. */
  | { kind: 'blank'; key: string }
  /** 아직 오지 않은 날. 당근을 그리지 않고 누를 수 없다. */
  | { kind: 'future'; date: string; day: number }
  | { kind: 'today'; date: string; day: number; solvedQuestionCount: number }
  | { kind: 'past'; date: string; day: number; solvedQuestionCount: number };

/** 날짜 칸을 눌렀을 때 갈 곳. */
export type ChallengeCalendarDayAction =
  /** 오늘은 문제를 더 풀 수 있어서 직접 조회하는 오늘 스테이지로 간다. */
  | { kind: 'open-today-stage' }
  | { kind: 'open-day-stage'; date: string; solvedQuestionCount: number }
  /** 푼 문제가 없는 지난 날짜. 스테이지를 열지 않고 안내 팝업을 띄운다. */
  | { kind: 'show-empty-day-notice' }
  | { kind: 'none' };

/** `YYYY-MM`을 `delta`달만큼 옮긴다. 날짜 객체를 쓰지 않아 시간대와 무관하다. */
export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const monthIndex = year * 12 + (month - 1) + delta;
  const shiftedYear = Math.floor(monthIndex / 12);
  const shiftedMonth = (monthIndex % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}`;
}

/** `2026-10` → `2026년 10월`. */
export function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}년 ${month}월`;
}

/** 이번 달 이력에서 오늘(KST)을 읽는다. 이번 달은 오늘까지만 오므로 가장 늦은 날짜다. */
export function getTodayFromCurrentMonth(currentMonth: ChallengeHistory): string | null {
  return currentMonth.days.reduce<string | null>(
    (latest, { date }) => (latest === null || date > latest ? date : latest),
    null,
  );
}

/**
 * 한 달을 주 단위 칸으로 나눈다. 일요일이 첫 칸이다.
 *
 * 이력에 없는 지난 날짜는 0문장으로 본다 — 지난 달은 서버가 모든 날짜를 주지만, 빠진 날이
 * 있어도 "푼 문제 없음"이 사실에 가장 가깝다. 오늘 뒤의 날짜는 이력에 오지 않는 것이 정상이다.
 */
export function buildChallengeCalendarWeeks(
  history: ChallengeHistory,
  today: string,
): ChallengeCalendarDay[][] {
  const [year, month] = history.yearMonth.split('-').map(Number);
  // Date.UTC로 요일과 말일만 계산한다. 이 값은 시간대와 무관한 달력 사실이다.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const solvedByDate = new Map(history.days.map((day) => [day.date, day.solvedQuestionCount]));

  const cells: ChallengeCalendarDay[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ kind: 'blank', key: `lead-${index}` });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${history.yearMonth}-${String(day).padStart(2, '0')}`;
    const solvedQuestionCount = solvedByDate.get(date) ?? 0;
    if (date > today) cells.push({ kind: 'future', date, day });
    else if (date === today) cells.push({ kind: 'today', date, day, solvedQuestionCount });
    else cells.push({ kind: 'past', date, day, solvedQuestionCount });
  }
  for (let index = 0; cells.length % DAYS_PER_WEEK !== 0; index += 1) {
    cells.push({ kind: 'blank', key: `trail-${index}` });
  }

  const weeks: ChallengeCalendarDay[][] = [];
  for (let start = 0; start < cells.length; start += DAYS_PER_WEEK) {
    weeks.push(cells.slice(start, start + DAYS_PER_WEEK));
  }
  return weeks;
}

/** 칸을 눌렀을 때 갈 곳(2026-10-11 결정). */
export function decideChallengeCalendarDayAction(
  day: ChallengeCalendarDay,
): ChallengeCalendarDayAction {
  switch (day.kind) {
    case 'today':
      return { kind: 'open-today-stage' };
    case 'past':
      return day.solvedQuestionCount > 0
        ? { kind: 'open-day-stage', date: day.date, solvedQuestionCount: day.solvedQuestionCount }
        : { kind: 'show-empty-day-notice' };
    case 'future':
    case 'blank':
      return { kind: 'none' };
    default: {
      const unreachable: never = day;
      return unreachable;
    }
  }
}

export type ChallengeCalendarState =
  | { status: 'loading' }
  /** 이력을 읽지 못했다. 달력을 그리지 않고, 다음에 마이페이지에 들어올 때 다시 읽는다. */
  | { status: 'hidden' }
  | {
      status: 'ready';
      yearMonth: string;
      weeks: ChallengeCalendarDay[][];
      /** 서버가 정한 이번 달이면 막는다. 미래 달은 400이다. */
      canGoNext: boolean;
    };

interface HistoryQueryResult {
  data: ChallengeHistory | undefined;
  error: Error | null;
}

/**
 * 이번 달 조회와 보고 있는 달 조회를 화면 상태 하나로.
 *
 * 이번 달 조회가 늘 먼저다 — 오늘이 언제인지, 다음 달 버튼을 막을지를 그 응답만 알려 준다.
 * 데이터를 오류보다 먼저 보는 것은 스테이지(`toChallengeStageState`)와 같은 이유다: 갖고 있던
 * 이력이 있으면 뒤에서 돈 재조회가 실패해도 달력을 지우지 않는다.
 *
 * @param viewingYearMonth `undefined`면 이번 달을 보고 있다.
 */
export function toChallengeCalendarState(
  currentMonth: HistoryQueryResult,
  viewingMonth: HistoryQueryResult,
  viewingYearMonth: string | undefined,
): ChallengeCalendarState {
  if (currentMonth.data === undefined) {
    return currentMonth.error === null ? { status: 'loading' } : { status: 'hidden' };
  }
  const today = getTodayFromCurrentMonth(currentMonth.data);
  if (today === null) return { status: 'hidden' };

  const shown = viewingYearMonth === undefined ? currentMonth.data : viewingMonth.data;
  if (shown === undefined) {
    return viewingMonth.error === null ? { status: 'loading' } : { status: 'hidden' };
  }

  return {
    status: 'ready',
    yearMonth: shown.yearMonth,
    weeks: buildChallengeCalendarWeeks(shown, today),
    canGoNext: viewingYearMonth !== undefined,
  };
}
