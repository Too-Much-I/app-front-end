import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactElement } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { PromotionApplication } from '@/features/promotion/promotion-application';
import { colors } from '@/theme';

/** 폼을 닫고 보여 주는 결과. 신청 상태를 기기에 저장하지 않아 다시 들어오면 폼부터 시작한다. */
export type PromotionResultKind =
  | { status: 'done'; application: PromotionApplication }
  | { status: 'already-applied' }
  | { status: 'closed' }
  | { status: 'unavailable' }
  | { status: 'unknown' };

interface ResultCopy {
  icon: ComponentProps<typeof Feather>['name'];
  iconColor: string;
  iconSurface: string;
  title: string;
  description: string;
}

function resultCopy(result: PromotionResultKind): ResultCopy {
  switch (result.status) {
    case 'done':
      return {
        icon: 'check',
        iconColor: colors.brand[600],
        iconSurface: colors.brand[100],
        title: '신청을 받았어요',
        description: '담당자가 성적표와 이용권 결제를 확인한 뒤 메일로 기프티콘을 보내드려요.',
      };
    case 'already-applied':
      return {
        icon: 'file-text',
        iconColor: colors.sky.text,
        iconSurface: colors.sky.surface,
        title: '이미 신청하셨어요',
        description:
          '이번 이벤트는 한 사람당 한 번만 신청할 수 있어요. 방금 보낸 신청이 이미 접수됐다면 다시 낼 필요 없어요.',
      };
    case 'closed':
      return {
        icon: 'clock',
        iconColor: colors.ink.muted,
        iconSurface: colors.surface.muted,
        title: '신청 기간이 끝났어요',
        description:
          '선착순 인원이 다 찼거나 기한이 지났어요. 다음 이벤트 소식은 앱에서 알려 드릴게요.',
      };
    case 'unavailable':
      return {
        icon: 'pause-circle',
        iconColor: colors.ink.muted,
        iconSurface: colors.surface.muted,
        title: '지금은 신청을 받지 않아요',
        description: '이벤트 신청이 잠시 멈춰 있어요. 나중에 다시 확인해 주세요.',
      };
    case 'unknown':
      return {
        icon: 'help-circle',
        iconColor: colors.ink.muted,
        iconSurface: colors.surface.muted,
        title: '접수 결과를 확인하지 못했어요',
        description:
          '신청이 들어갔을 수도 있어요. 잠시 뒤 다시 신청해 보고, "이미 신청하셨어요"가 보이면 접수된 거예요.',
      };
  }
}

interface PromotionResultProps {
  result: PromotionResultKind;
  onClose: () => void;
}

export function PromotionResult({ result, onClose }: PromotionResultProps): ReactElement {
  const copy = resultCopy(result);

  return (
    <View className="flex-1 px-screen pb-lg">
      <View className="flex-1 items-center justify-center gap-element">
        <View
          className="h-20 w-20 items-center justify-center rounded-pill"
          style={{ backgroundColor: copy.iconSurface }}
        >
          <Feather name={copy.icon} size={40} color={copy.iconColor} />
        </View>
        <Text accessibilityRole="header" className="text-center text-2xl">
          {copy.title}
        </Text>
        <Text className="text-center text-sm leading-6 text-ink-muted">{copy.description}</Text>
        {result.status === 'done' ? (
          <View className="mt-sm w-full gap-sm rounded-card border border-line bg-surface p-card">
            <View className="flex-row justify-between gap-md">
              <Text className="text-sm text-ink-muted">받을 기프티콘</Text>
              <Text className="text-sm">{result.application.gifticon}</Text>
            </View>
            <View className="flex-row justify-between gap-md">
              <Text className="text-sm text-ink-muted">받을 메일</Text>
              <Text className="flex-1 text-right text-sm" numberOfLines={1}>
                {result.application.email}
              </Text>
            </View>
          </View>
        ) : null}
        {result.status === 'done' ? (
          <Text className="text-center text-xs text-ink-muted">
            신청 내용은 바꿀 수 없어요. 잘못 넣었다면 문의하기로 알려 주세요.
          </Text>
        ) : null}
      </View>
      <Button label="확인" size="lg" onPress={onClose} />
    </View>
  );
}
