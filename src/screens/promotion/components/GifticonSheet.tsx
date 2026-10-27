import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import {
  PROMOTION_GIFTICON_AMOUNT_LABEL,
  PROMOTION_GIFTICONS,
  type PromotionGifticonId,
} from '@/features/promotion/promotion-application';
import { colors, size } from '@/theme';

interface GifticonSheetProps {
  visible: boolean;
  selected: PromotionGifticonId | null;
  onSelect: (gifticon: PromotionGifticonId) => void;
  onClose: () => void;
}

/**
 * 받고 싶은 기프티콘을 고르는 바텀 시트(2026-10-27 시안 2). 줄을 눌러 고르고 "선택하기"로 확정한다 —
 * 줄을 누르자마자 닫으면 잘못 누른 것을 바로잡을 틈이 없다.
 */
export function GifticonSheet({ visible, selected, onSelect, onClose }: GifticonSheetProps) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<PromotionGifticonId | null>(selected);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setPending(selected)}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          accessibilityLabel="기프티콘 선택 닫기"
          accessibilityRole="button"
          className="flex-1"
          onPress={onClose}
        />
        {/* 아래 인셋은 제스처 바 영역이라 rem 여백(`pb-lg`)과 따로 더한다. */}
        <View
          accessibilityViewIsModal
          className="rounded-t-card bg-surface"
          style={{ paddingBottom: insets.bottom }}
        >
          <View className="gap-element px-screen pb-lg pt-sm">
            <View className="h-1 w-10 self-center rounded-pill bg-line" />
            <View className="flex-row items-center justify-between">
              <Text accessibilityRole="header" className="text-xl">
                받고 싶은 기프티콘
              </Text>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center"
                onPress={onClose}
              >
                <Feather name="x" size={size.icon.lg} color={colors.ink.muted} />
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup">
              {PROMOTION_GIFTICONS.map((gifticon) => {
                const checked = gifticon.id === pending;
                return (
                  <Pressable
                    key={gifticon.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked }}
                    className="min-h-control-lg flex-row items-center gap-md border-b border-line py-sm"
                    onPress={() => setPending(gifticon.id)}
                  >
                    <View className="flex-1 gap-xs">
                      <Text className={checked ? 'text-base !text-brand-text' : 'text-base'}>
                        {gifticon.name}
                      </Text>
                      <Text className="text-xs text-ink-muted">
                        {PROMOTION_GIFTICON_AMOUNT_LABEL}
                      </Text>
                    </View>
                    <Feather
                      name={checked ? 'check-circle' : 'circle'}
                      size={size.icon.lg}
                      color={checked ? colors.brand.DEFAULT : colors.ink.disabled}
                    />
                  </Pressable>
                );
              })}
            </View>
            <Button
              disabled={pending === null}
              label="선택하기"
              size="lg"
              onPress={() => {
                if (pending === null) return;
                onSelect(pending);
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
