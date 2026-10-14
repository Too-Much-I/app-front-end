import { Feather } from '@expo/vector-icons';
import {
  useIsFocused,
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { StartMockExamButton } from '@/components/ui/StartMockExamButton';
import { Text } from '@/components/ui/Text';
import { useExamAdmission } from '@/features/pass/use-exam-admission';
import type { MockExamStackParamList, RootStackParamList } from '@/navigation/types';
import { ExamReadyNoticeCard } from '@/screens/mock-exam/components/ExamReadyNoticeCard';
import { colors } from '@/theme';
import type { ExamAdmission } from '@/types/pass';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
// "조용히" 몸짓의 마스코트 — 안내 목록 첫 항목(조용한 곳에서 응시)과 그림이 그대로 맞는다.
const readyMascot = require('../../../public/mascots/shh.png');

/** 응시권이 없으면 루트 스택의 이용권 화면으로 보내야 해서 두 내비게이터를 함께 쓴다. */
type MockExamReadyNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<MockExamStackParamList, 'MockExamReady'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * 모의고사 준비(안내) 화면 — 모의고사 탭 자체가 이 화면이다.
 *
 * 마이크 권한·소리 확인 같은 검증은 하지 않는 안내 전용 화면이다. "시작하기"를 누르면
 * 별도 기기 테스트 단계로 이동하고, 두 테스트를 마쳐야 실제 응시를 시작할 수 있다.
 *
 * 탭바는 그대로 남는다 — 아직 응시에 진입하지 않았으므로 다른 탭으로 빠져나갈 수 있어야 한다.
 * (실제 응시 화면은 반대로 탭바를 숨겨야 한다. 20분 응시 중 탭 오터치로 세션이 날아가면 안 된다.)
 *
 * 들어올 때마다 응시권을 확인한다. 홈·모의고사 탭·피드백 모두 이 화면으로 들어오므로 여기서 막으면 볼 수 없는
 * 시험의 마이크 테스트를 하지 않게 된다(2026-10-14 결정). 최종 판단은 시험을 만들 때 서버가 한다.
 */
export function MockExamReadyScreen() {
  const navigation = useNavigation<MockExamReadyNavigationProp>();
  const admission = useExamAdmission();
  const isFocused = useIsFocused();
  // 다시 읽다 실패하면 이전 결과 대신 확인 불가로 본다. 조회 실패를 0개·사용 완료로 바꾸지 않는다(명세).
  const notice: ExamAdmission | null = admission.isError
    ? { kind: 'unknown' }
    : (admission.data ?? null);
  const status = notice?.kind ?? 'loading';
  usePassRequiredRedirect({
    isActive: isFocused && !admission.isFetching && status === 'pass-required',
    resultAt: admission.dataUpdatedAt,
    openPass: () => navigation.navigate('PassPurchase'),
  });

  const handleStartExam = () => {
    navigation.navigate('MicrophoneTest');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center justify-between px-screen">
        <Text className="text-xl">모의고사</Text>
        <Pressable
          accessibilityHint="파트별 문제 유형과 제한 시간을 확인합니다"
          accessibilityLabel="파트별 진행 방식 보기"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full"
          onPress={() => navigation.navigate('ExamPartGuide')}
        >
          <Feather name="help-circle" size={24} color={colors.ink.muted} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-screen">
          {/* 헤드라인 — 아래 목록 전체가 무엇을 위한 것인지 한 줄로 묶어준다 */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-2xl leading-8">시작하기 전에{'\n'}확인해주세요</Text>
              <Text className="mt-1.5 text-sm text-ink-muted">
                한 번 시작하면 중간에 멈출 수 없어요
              </Text>
            </View>
            {/* 원본은 여백을 잘라낸 세로형(738×927)이다. contain이라 정사각 박스에서도
                잘리지 않고, 좌우에 남는 공간만큼 실제 그림이 작아진다 */}
            <Image source={readyMascot} className="h-32 w-32" resizeMode="contain" />
          </View>

          <View className="mt-4">
            <ExamReadyNoticeCard />
          </View>

          {notice ? (
            <View className="mt-4">
              <ExamAdmissionNotice
                admission={notice}
                isRetrying={admission.isFetching}
                onOpenPass={() => navigation.navigate('PassPurchase')}
                onRetry={() => void admission.refetch()}
              />
            </View>
          ) : null}
        </View>

        {/* 남는 공간의 중앙에 CTA를 두고, 작은 화면에서는 전체 콘텐츠와 함께 스크롤한다. */}
        <View className="flex-1 justify-center px-screen py-4">
          {/* 마이크 테스트를 포함한 모의고사 준비 흐름 전체를 시작하는 버튼이다. */}
          <StartMockExamButton
            accessibilityHint="마이크와 소리 테스트를 거쳐 모의고사를 시작합니다"
            disabled={status !== 'allowed'}
            loading={status === 'loading'}
            onPress={handleStartExam}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * 응시권이 없다는 결과가 나오면 이용권 화면으로 한 번 보낸다(2026-10-14 결정). 이용권 화면에서 돌아온 뒤의
 * 재조회 결과로는 다시 보내지 않는다 — 돌아올 때마다 보내면 사용자가 빠져나갈 수 없다. 다른 곳에 갔다가 다시
 * 들어오면 다시 보낸다.
 */
function usePassRequiredRedirect({
  isActive,
  resultAt,
  openPass,
}: {
  isActive: boolean;
  resultAt: number;
  openPass: () => void;
}) {
  const handledResultAt = useRef<number | null>(null);
  const isReturningFromPass = useRef(false);

  useEffect(() => {
    if (!isActive || handledResultAt.current === resultAt) return;
    handledResultAt.current = resultAt;
    if (isReturningFromPass.current) {
      isReturningFromPass.current = false;
      return;
    }
    isReturningFromPass.current = true;
    openPass();
  }, [isActive, resultAt, openPass]);
}

function formatPassEndsAt(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일까지`;
}

/** 시작 전 응시권 안내. 무엇이 쓰이는지, 왜 시작할 수 없는지 말한다. */
function ExamAdmissionNotice({
  admission,
  isRetrying,
  onRetry,
  onOpenPass,
}: {
  admission: ExamAdmission;
  isRetrying: boolean;
  onRetry: () => void;
  onOpenPass: () => void;
}) {
  switch (admission.kind) {
    case 'allowed': {
      const lines = [
        admission.source === 'free' ? '무료 응시권 1회를 사용해요' : null,
        admission.source === 'paid'
          ? ['이용권 이용 중', admission.paidEndsAt ? formatPassEndsAt(admission.paidEndsAt) : null]
              .filter(Boolean)
              .join(' · ')
          : null,
        admission.hasPendingPayment ? '결제를 처리하고 있어요' : null,
      ].filter((line): line is string => line !== null);
      if (lines.length === 0) return null;
      return (
        <View className="gap-1 rounded-card bg-surface px-4 py-3">
          {lines.map((line) => (
            <Text key={line} className="text-sm text-ink">
              {line}
            </Text>
          ))}
        </View>
      );
    }
    case 'payment-pending':
      return (
        <AdmissionBlockedNotice
          actionLabel="다시 확인하기"
          isLoading={isRetrying}
          message="결제를 처리하고 있어요. 잠시 후 다시 확인해 주세요."
          onAction={onRetry}
        />
      );
    case 'pass-required':
      return (
        <AdmissionBlockedNotice
          actionLabel="이용권 보러 가기"
          message="모의고사를 보려면 이용권이 필요해요."
          onAction={onOpenPass}
        />
      );
    case 'unknown':
      return (
        <AdmissionBlockedNotice
          actionLabel="다시 시도하기"
          isLoading={isRetrying}
          message="지금은 응시권을 확인할 수 없어요. 잠시 후 다시 시도해 주세요."
          onAction={onRetry}
        />
      );
  }
}

function AdmissionBlockedNotice({
  message,
  actionLabel,
  onAction,
  isLoading = false,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  isLoading?: boolean;
}) {
  return (
    <View className="items-start gap-3 rounded-card bg-surface px-4 py-3">
      <Text className="text-sm text-ink">{message}</Text>
      <Button
        label={actionLabel}
        loading={isLoading}
        onPress={onAction}
        size="sm"
        variant="secondary"
      />
    </View>
  );
}
