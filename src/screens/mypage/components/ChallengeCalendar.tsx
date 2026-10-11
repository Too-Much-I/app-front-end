import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { CHALLENGE_QUESTIONS_PER_DAY } from '@/features/challenge/challenge-day';
import {
  formatYearMonthLabel,
  type ChallengeCalendarDay,
} from '@/screens/mypage/challenge-calendar';
import { ChallengeCarrot } from '@/screens/mypage/components/ChallengeCarrot';
import { colors, shadows } from '@/theme';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** 칸 너비(약 46dp)에 맞춘 당근 크기. 높이는 그림 비(40:56)를 따른다. */
const CARROT_WIDTH = 24;

interface ChallengeCalendarProps {
  yearMonth: string;
  weeks: ChallengeCalendarDay[][];
  canGoNext: boolean;
  /** 다른 달을 받는 중이면 두 버튼을 모두 막는다. */
  isChangingMonth: boolean;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: ChallengeCalendarDay) => void;
}

/**
 * 한 달의 10초 챌린지 참여를 당근으로 보여 주는 달력.
 *
 * 무엇을 누르면 어디로 가는지는 모른다 — 칸을 넘기기만 하고 판단은 화면이 한다.
 */
export function ChallengeCalendar({
  yearMonth,
  weeks,
  canGoNext,
  isChangingMonth,
  onPreviousMonth,
  onNextMonth,
  onSelectDay,
}: ChallengeCalendarProps) {
  return (
    <View className="rounded-card bg-surface p-3" style={shadows.card}>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel="이전 달"
          accessibilityRole="button"
          accessibilityState={{ busy: isChangingMonth }}
          className="h-11 w-11 items-center justify-center rounded-full"
          disabled={isChangingMonth}
          onPress={onPreviousMonth}
        >
          <Feather color={colors.ink.muted} name="chevron-left" size={22} />
        </Pressable>
        <Text accessibilityRole="header" className="text-lg">
          {formatYearMonthLabel(yearMonth)}
        </Text>
        <Pressable
          accessibilityLabel="다음 달"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoNext, busy: isChangingMonth }}
          className="h-11 w-11 items-center justify-center rounded-full"
          // 받는 중에는 누르지 못하게만 하고 색은 바꾸지 않는다. 짧은 대기마다 버튼이 깜빡이지 않게.
          disabled={!canGoNext || isChangingMonth}
          onPress={onNextMonth}
        >
          <Feather
            color={canGoNext ? colors.ink.muted : colors.line.DEFAULT}
            name="chevron-right"
            size={22}
          />
        </Pressable>
      </View>

      <View className="mt-1 flex-row">
        {WEEKDAY_LABELS.map((label) => (
          <Text className="flex-1 text-center text-xs text-ink-muted" key={label}>
            {label}
          </Text>
        ))}
      </View>

      <View className="mt-1 gap-1">
        {weeks.map((week) => (
          <View className="flex-row gap-1" key={week.map(getDayKey).join('|')}>
            {week.map((day) => (
              <ChallengeCalendarCell day={day} key={getDayKey(day)} onSelect={onSelectDay} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function getDayKey(day: ChallengeCalendarDay): string {
  return day.kind === 'blank' ? day.key : day.date;
}

function ChallengeCalendarCell({
  day,
  onSelect,
}: {
  day: ChallengeCalendarDay;
  onSelect: (day: ChallengeCalendarDay) => void;
}) {
  // 날짜 숫자(15) + 당근(약 34) + 위아래 여백. 당근 크기에 묶인 값이라 토큰이 아니다.
  // 최소값만 둔다 — 기기 글씨가 커지면 숫자가 높이를 밀어야 당근이 칸 밖으로 나가지 않는다.
  // 한 주의 칸들은 가로 줄에서 늘어나(stretch) 높이가 같게 맞춰진다.
  const cellClassName = 'min-h-[60px] flex-1 items-center rounded-xl pb-1 pt-1';

  if (day.kind === 'blank') return <View className={cellClassName} />;

  if (day.kind === 'future') {
    return (
      <View accessibilityLabel={`${day.day}일`} accessible className={cellClassName}>
        <Text className="text-xs text-ink-disabled">{day.day}</Text>
      </View>
    );
  }

  const isToday = day.kind === 'today';

  return (
    <Pressable
      accessibilityHint={
        day.solvedQuestionCount > 0 || isToday ? '이날의 진행도를 엽니다' : undefined
      }
      accessibilityLabel={`${isToday ? '오늘, ' : ''}${day.day}일, ${CHALLENGE_QUESTIONS_PER_DAY}문장 중 ${day.solvedQuestionCount}문장`}
      accessibilityRole="button"
      className={`${cellClassName} border-2 ${isToday ? 'border-brand-cta' : 'border-transparent'}`}
      onPress={() => onSelect(day)}
    >
      <Text className={`text-xs ${isToday ? 'text-brand-text' : 'text-ink'}`}>{day.day}</Text>
      <ChallengeCarrot solvedQuestionCount={day.solvedQuestionCount} width={CARROT_WIDTH} />
    </Pressable>
  );
}
