import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { MascotModal } from '@/components/ui/MascotModal';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { Text } from '@/components/ui/Text';
import { formatInstalledAppVersion } from '@/features/app-version/installed-app-version';
import { useSignOutConfirmation } from '@/features/auth/use-sign-out-confirmation';
import { useMyProfile } from '@/features/profile/use-my-profile';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import {
  decideChallengeCalendarDayAction,
  type ChallengeCalendarDay,
} from '@/screens/mypage/challenge-calendar';
import { ChallengeCalendar } from '@/screens/mypage/components/ChallengeCalendar';
import { MyPageGreeting } from '@/screens/mypage/components/MyPageGreeting';
import { MyPageMenuRow } from '@/screens/mypage/components/MyPageMenuRow';
import { useChallengeCalendar } from '@/screens/mypage/hooks/use-challenge-calendar';
import { shadows } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const shockedRabbit = require('../../../public/mascots/shocked_rabbit.png');

/** 탭 안에서 루트 스택의 스테이지·설정·문의·이용권 화면으로 이동해야 하므로 두 내비게이터를 함께 쓴다. */
type MyPageNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'MyPage'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * 닉네임 인사, 10초 챌린지 달력, 메뉴.
 *
 * 설정의 항목 중 자주 찾는 문의하기·로그아웃만 꺼내고 나머지는 설정으로 보낸다
 * (2026-10-11 결정). 이용권 결제는 마이페이지 메뉴를 진입로로 쓴다(2026-10-11 결정). 친구 초대는 이용권 결제 바로 아래다(2026-10-29 결정). 탈퇴를 눈에 띄게 권하지 않는다는 2026-10-07 결정 때문에 탈퇴는 설정 안에 둔다.
 */
export function MyPageScreen() {
  const navigation = useNavigation<MyPageNavigationProp>();
  const profile = useMyProfile();
  const calendar = useChallengeCalendar();
  const confirmSignOut = useSignOutConfirmation();
  const [isEmptyDayNoticeVisible, setEmptyDayNoticeVisible] = useState(false);

  const selectDay = useCallback(
    (day: ChallengeCalendarDay) => {
      const action = decideChallengeCalendarDayAction(day);
      switch (action.kind) {
        case 'open-today-stage':
          navigation.navigate('ChallengeStage');
          return;
        case 'open-day-stage':
          navigation.navigate('ChallengeDayStage', {
            challengeDate: action.date,
            solvedQuestionCount: action.solvedQuestionCount,
          });
          return;
        case 'show-empty-day-notice':
          setEmptyDayNoticeVisible(true);
          return;
        case 'none':
          return;
        default: {
          const unreachable: never = action;
          return unreachable;
        }
      }
    },
    [navigation],
  );

  const closeEmptyDayNotice = useCallback(() => setEmptyDayNoticeVisible(false), []);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <View className="h-14 flex-row items-center px-screen">
        <Text accessibilityRole="header" className="text-2xl">
          마이페이지
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* 인사 카드의 토끼(h-32)가 카드(h-24) 위로 32dp 솟는다. 위 여백이 그보다 작으면
            스크롤 영역 경계에서 귀가 잘린다. */}
        <View className="gap-section px-screen pb-10 pt-10">
          <MyPageGreeting nickname={profile.data?.nickname ?? null} />

          {calendar.state.status === 'loading' ? (
            <SkeletonBlock className="h-96 w-full rounded-card" />
          ) : null}

          {calendar.state.status === 'ready' ? (
            <ChallengeCalendar
              canGoNext={calendar.state.canGoNext}
              isChangingMonth={calendar.isChangingMonth}
              onNextMonth={calendar.goToNextMonth}
              onPreviousMonth={calendar.goToPreviousMonth}
              onSelectDay={selectDay}
              weeks={calendar.state.weeks}
              yearMonth={calendar.state.yearMonth}
            />
          ) : null}

          <View className="rounded-card border border-line bg-surface px-4" style={shadows.card}>
            <MyPageMenuRow
              description="기간 안에 모의고사를 무제한으로 풀 수 있어요."
              icon="credit-card"
              onPress={() => navigation.navigate('PassPurchase')}
              title="이용권 결제"
            />
            <MyPageMenuRow
              description="친구와 모의고사권을 1장씩 받아요."
              icon="user-plus"
              onPress={() => navigation.navigate('ReferralInvite', { entry: 'mypage' })}
              title="친구 초대"
            />
            <MyPageMenuRow
              description="성적을 올리고 기프티콘 5천 원을 받아요."
              icon="gift"
              onPress={() => navigation.navigate('PromotionApplication')}
              title="성적 입력 이벤트"
            />
            <MyPageMenuRow
              description="버그 제보 및 기능 제안을 할 수 있어요."
              icon="message-circle"
              onPress={() => navigation.navigate('SupportInquiry', { screen: 'mypage' })}
              title="문의하기"
            />
            <MyPageMenuRow
              description="약관 · 개인정보 · 학습 기록 · 회원 탈퇴"
              icon="settings"
              onPress={() => navigation.navigate('Settings')}
              title="설정"
            />
            <MyPageMenuRow
              icon="log-out"
              onPress={confirmSignOut}
              showDivider={false}
              title="로그아웃"
            />
          </View>

          <Text className="text-center text-xs text-ink-muted">
            버전 {formatInstalledAppVersion()}
          </Text>
        </View>
      </ScrollView>

      <MascotModal
        cropMascotBottom
        mascot={shockedRabbit}
        message="이날은 푼 문제가 없어서 결과를 조회할 수 없어요."
        onRequestClose={closeEmptyDayNotice}
        visible={isEmptyDayNoticeVisible}
      >
        <Button
          className="mt-section w-full"
          label="닫기"
          onPress={closeEmptyDayNotice}
          size="lg"
        />
      </MascotModal>

      <MascotModal
        cropMascotBottom
        mascot={shockedRabbit}
        message="이 달의 기록을 불러오지 못해서 더 이상 넘길 수 없어요."
        onRequestClose={calendar.dismissMonthChangeFailure}
        visible={calendar.isMonthChangeFailed}
      >
        <Button
          className="mt-section w-full"
          label="닫기"
          onPress={calendar.dismissMonthChangeFailure}
          size="lg"
        />
      </MascotModal>
    </SafeAreaView>
  );
}
