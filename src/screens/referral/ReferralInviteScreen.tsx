import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { buildReferralShareMessage } from '@/features/referral/referral-share';
import { useMyReferralCode } from '@/features/referral/use-my-referral-code';
import { trackEvent } from '@/lib/amplitude';
import type { ReferralInviteEntry } from '@/lib/analytics-events';
import type { RootStackParamList } from '@/navigation/types';
import { colors, shadows, size } from '@/theme';

// public/은 `@/` 별칭 범위(./src) 밖이라 상대 경로로 require한다.
const friendsIllustration = require('../../../public/mascots/friends_turtle_cat.png');

type ReferralInviteScreenProps = NativeStackScreenProps<RootStackParamList, 'ReferralInvite'>;

/** 공유 창을 연다. 열지 못하면(드문 OS 오류) 조용히 끝낸다 — 다시 누르면 된다. */
async function shareReferralCode(code: string, entry: ReferralInviteEntry): Promise<void> {
  trackEvent({ name: 'referral_share_clicked', properties: { entry } });
  try {
    const result = await Share.share({ message: buildReferralShareMessage(code) });
    trackEvent({
      name: 'referral_shared',
      properties: { entry, result: result.action === Share.sharedAction ? 'shared' : 'dismissed' },
    });
  } catch {
    // 공유 창을 열지 못했다.
  }
}

/**
 * 친구 초대(2026-10-29 시안 D, 설계 https://claude.ai/artifact/KhVxreByjTrv1o1Rr6UG4X). 내 추천 코드를 보여 주고
 * 기본 공유 창으로 웹 초대 링크를 보낸다. 복사하기는 이번에 넣지 않는다(클립보드 라이브러리가 없어 네이티브
 * 빌드가 필요하다). 마이페이지 메뉴와 홈의 친구 초대 팝업으로 들어온다.
 */
export function ReferralInviteScreen({ navigation, route }: ReferralInviteScreenProps) {
  const myCode = useMyReferralCode();
  const code = myCode.data ?? null;

  return (
    <SafeAreaView className="flex-1 bg-surface-subtle">
      <View className="min-h-control-lg flex-row items-center gap-content px-screen">
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          onPress={navigation.goBack}
        >
          <Feather name="chevron-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="text-xl">친구 초대</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-section px-screen pb-section pt-sm"
      >
        <View className="gap-xs">
          <Text accessibilityRole="header" className="text-2xl">
            초대하면 둘 다 1장씩!
          </Text>
          <Text className="text-sm text-ink-muted">친구가 가입할 때 내 코드를 넣으면 돼요.</Text>
        </View>

        <Image
          accessible={false}
          className="h-56 w-full"
          resizeMode="contain"
          source={friendsIllustration}
        />

        <View
          className="min-h-28 items-center justify-center gap-xs rounded-card border border-sky-line bg-sky-surface p-card"
          style={shadows.card}
        >
          <Text className="text-sm text-sky-text">내 추천 코드</Text>
          {code ? (
            <Text
              accessibilityLabel={`내 추천 코드 ${code.split('').join(' ')}`}
              className="text-3xl tracking-widest text-sky-text"
              selectable
            >
              {code}
            </Text>
          ) : myCode.isError ? (
            <Text accessibilityRole="alert" className="text-center text-sm text-sky-text">
              추천 코드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : (
            <ActivityIndicator color={colors.sky.text} />
          )}
        </View>

        <View className="gap-content">
          {code ? (
            <Button
              label="공유하기"
              size="lg"
              onPress={() => void shareReferralCode(code, route.params.entry)}
            />
          ) : myCode.isError ? (
            <Button
              label="다시 시도하기"
              loading={myCode.isFetching}
              size="lg"
              onPress={() => void myCode.refetch()}
            />
          ) : null}
          <Text className="text-center text-xs text-ink-muted">
            초대할 수 있는 친구 수에는 제한이 없어요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
