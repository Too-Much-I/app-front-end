import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  DEFAULT_PASS_OFFER_CODE,
  describePassPerDay,
  type PassOfferCode,
} from '@/features/pass/pass-products';
import {
  usePassPurchase,
  type PassOption,
  type PassOptionGroup,
  type PassPurchaseOutcome,
} from '@/features/pass/use-pass-purchase';
import type { RootStackParamList } from '@/navigation/types';
import { colors, shadows } from '@/theme';

type PassPurchaseScreenProps = NativeStackScreenProps<RootStackParamList, 'PassPurchase'>;

const REFUND_NOTICES = [
  '이용권은 결제 즉시 시작되며, 이용 시작 후에는 환불이 제한될 수 있어요.',
  '모의고사를 한 번도 풀지 않았다면 환불받을 수 있어요.',
  '결제와 환불은 App Store · Google Play 정책을 따라요.',
] as const;

function PassProductTile({
  option,
  isSelected,
  onPress,
}: {
  option: PassOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { product, price } = option;
  const perDay = describePassPerDay(option.days, price);

  return (
    <Pressable
      accessibilityLabel={[product.label, price.label, perDay].filter(Boolean).join(', ')}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      className={`min-w-0 flex-1 gap-xs rounded-control border-2 px-md py-md ${
        isSelected ? 'border-brand bg-brand-50' : 'border-line bg-surface'
      }`}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <Text className={`text-base ${isSelected ? 'text-brand-text' : 'text-ink'}`}>
          {product.label}
        </Text>
        <View
          className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
            isSelected ? 'border-brand bg-brand' : 'border-line bg-surface'
          }`}
        >
          {isSelected ? <Feather name="check" size={12} color={colors.surface.DEFAULT} /> : null}
        </View>
      </View>
      <Text className="text-2xl">{price.label}</Text>
      {perDay ? <Text className="text-xs text-ink-muted">{perDay}</Text> : null}
    </Pressable>
  );
}

/**
 * 기간제 이용권 선택 화면.
 *
 * 다섯 가격이 스크롤 없이 한 번에 보이도록 그룹 카드 안에 가격 타일을 나란히 둔다.
 * 결제 버튼은 화면 아래에 하나만 두고, 무엇을 얼마에 사는지 버튼 라벨이 말한다.
 *
 * Billing 상품 목록과 스토어(RevenueCat Offering)가 서로 가리키는 상품만 보여 주고, 가격은 스토어 값이다.
 * 결제가 끝나면 Billing 반영을 확인한 결과를 알린다.
 */
export function PassPurchaseScreen({ navigation }: PassPurchaseScreenProps) {
  const { options, isPurchasing, purchase } = usePassPurchase();
  const [selectedCode, setSelectedCode] = useState<PassOfferCode>(DEFAULT_PASS_OFFER_CODE);
  const groups = options.data ?? [];
  const available = groups.flatMap((group) => group.options);
  // 기본 상품이 스토어에 없으면 첫 상품을 고른다.
  const selected =
    available.find((option) => option.product.offerCode === selectedCode) ?? available[0] ?? null;

  async function handlePurchase(option: PassOption) {
    const outcome = await purchase(option);
    if (outcome)
      showPurchaseOutcome(outcome, () =>
        navigation.navigate('SupportInquiry', { screen: 'pass-purchase', category: 'GENERAL' }),
      );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-subtle">
      <View className="h-16 flex-row items-center px-screen">
        <Pressable
          accessibilityLabel="뒤로 가기"
          className="h-10 w-10 items-center justify-center rounded-full"
          hitSlop={8}
          onPress={navigation.goBack}
        >
          <Feather name="arrow-left" size={24} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text className="ml-2 text-2xl">이용권</Text>
      </View>

      {options.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand.DEFAULT} size="large" />
        </View>
      ) : options.isError ? (
        // 불러오지 못하면 상품 화면을 보여 주지 않는다. 실패를 "판매 없음"으로 숨기지 않는다(Billing 명세).
        <PassLoadMessage
          message="이용권 정보를 불러오지 못했어요."
          onRetry={() => void options.refetch()}
          retrying={options.isFetching}
        />
      ) : groups.length === 0 ? (
        // Billing이 판매를 멈췄거나(빈 목록) Billing과 스토어 사이에 맞는 상품이 없다.
        <PassLoadMessage message="지금은 구매할 수 있는 이용권이 없어요." />
      ) : (
        <>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-lg px-screen pb-section pt-sm">
              <View className="gap-xs">
                <Text className="text-2xl">준비 기간에 맞는 이용권</Text>
                <Text className="text-sm text-ink-muted">
                  모든 이용권은 기간 안에 무제한이에요.
                </Text>
              </View>

              <PassOptions
                groups={groups}
                onSelect={setSelectedCode}
                selectedCode={selected?.product.offerCode ?? null}
              />

              <View className="gap-sm px-xs pt-sm">
                {REFUND_NOTICES.map((notice) => (
                  <Text key={notice} className="text-xs text-ink-muted">
                    {notice}
                  </Text>
                ))}
                <View className="mt-xs flex-row gap-lg">
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() =>
                      navigation.navigate('SettingsWebView', {
                        path: '/app-settings/terms',
                        title: '이용약관',
                      })
                    }
                  >
                    <Text className="text-sm text-brand-text">이용약관</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="link"
                    hitSlop={8}
                    onPress={() =>
                      navigation.navigate('SettingsWebView', {
                        path: '/app-settings/privacy',
                        title: '개인정보 처리방침',
                      })
                    }
                  >
                    <Text className="text-sm text-brand-text">개인정보 처리방침</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </ScrollView>

          <View className="bg-surface px-screen pb-sm pt-md" style={shadows.raisedBottom}>
            <Button
              label={
                selected
                  ? `${selected.product.label} · ${selected.price.label} 결제하기`
                  : '결제하기'
              }
              disabled={!selected}
              loading={isPurchasing}
              onPress={() => {
                if (selected) void handlePurchase(selected);
              }}
              size="lg"
              className="w-full"
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

/**
 * 결제 결과 안내(2026-10-14 결정). 반영되면 알림만, 문의가 필요하면 문의하기 버튼만 둔다. 결제 창을 닫았거나
 * 확인 중에 로그인 화면으로 갔으면 알리지 않는다.
 */
function showPurchaseOutcome(outcome: PassPurchaseOutcome, openSupport: () => void): void {
  switch (outcome) {
    case 'applied':
      Alert.alert('이용권이 반영됐어요');
      return;
    case 'pending':
      Alert.alert('결제를 확인하고 있어요', '확인이 끝나면 이용권이 자동으로 반영돼요.');
      return;
    case 'contact-support':
      Alert.alert('결제 확인이 필요해요', '문의를 남겨 주시면 확인해 드릴게요.', [
        { text: '문의하기', onPress: openSupport },
      ]);
      return;
    case 'cancelled':
      return;
    case 'failed':
      Alert.alert('결제하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
  }
}

function PassLoadMessage({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-content px-screen">
      <Text className="text-base">{message}</Text>
      {onRetry ? (
        <Button
          label="다시 불러오기"
          loading={retrying}
          onPress={onRetry}
          size="md"
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

function PassOptions({
  groups,
  selectedCode,
  onSelect,
}: {
  groups: readonly PassOptionGroup[];
  selectedCode: PassOfferCode | null;
  onSelect: (code: PassOfferCode) => void;
}) {
  return groups.map((group) => (
    <View
      key={group.title}
      accessibilityRole="radiogroup"
      className="gap-element rounded-card bg-surface p-card"
      style={shadows.card}
    >
      <View className="flex-row items-baseline justify-between gap-content">
        <Text className="text-lg">{group.title}</Text>
        <Text className="text-xs text-ink-muted">{group.description}</Text>
      </View>
      <View className="flex-row gap-content">
        {group.options.map((option) => (
          <PassProductTile
            key={option.product.offerCode}
            isSelected={option.product.offerCode === selectedCode}
            onPress={() => onSelect(option.product.offerCode)}
            option={option}
          />
        ))}
      </View>
    </View>
  ));
}
