import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import type { LearningLevel } from '@/features/learning/learning-types';
import { colors, layout, shadows, size, spacing } from '@/theme';

const LEVELS = ['IM3', 'IH', 'AL'] as const;
// The three 44 pt choices fit in a compact menu aligned with the filter row.
const MENU_WIDTH = 144;
const MENU_HEIGHT = size.hitTarget * LEVELS.length + spacing.xs * 2;

export function LearningLevelSelect({
  value,
  onChange,
}: {
  value: LearningLevel;
  onChange: (level: LearningLevel) => void;
}) {
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; bottom: number } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const label = value === 'IM3' ? 'IM' : value;
  const close = () => setAnchor(null);
  return (
    <>
      <View ref={trigger} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`답변 등급 ${label}, 등급 선택`}
          accessibilityState={{ expanded: anchor !== null }}
          onPress={() => {
            trigger.current?.measureInWindow((x, y, triggerWidth, triggerHeight) =>
              setAnchor({ x: x + triggerWidth, bottom: y + triggerHeight }),
            );
          }}
          className="h-11 flex-row items-center justify-center gap-sm rounded-control border border-line bg-surface px-md"
        >
          <Text className="text-sm font-semibold">{label}</Text>
          <Feather name="chevron-down" size={size.icon.sm} color={colors.ink.muted} />
        </Pressable>
      </View>
      <Modal transparent visible={anchor !== null} animationType="fade" onRequestClose={close}>
        <View className="flex-1" accessibilityViewIsModal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="등급 선택 닫기"
            className="absolute inset-0"
            onPress={close}
          />
          {anchor ? (
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="답변 등급"
              className="absolute rounded-control border border-line bg-surface p-xs"
              style={[
                shadows.card,
                {
                  width: MENU_WIDTH,
                  right: Math.max(layout.screen, width - anchor.x),
                  top: Math.max(
                    insets.top,
                    Math.min(anchor.bottom + spacing.xs, height - insets.bottom - MENU_HEIGHT),
                  ),
                },
              ]}
            >
              {LEVELS.map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="radio"
                  accessibilityLabel={`${level === 'IM3' ? 'IM' : level} 답변`}
                  accessibilityState={{ checked: level === value }}
                  onPress={() => {
                    onChange(level);
                    close();
                  }}
                  className={`h-11 flex-row items-center justify-between rounded-xl px-md ${level === value ? 'bg-brand-50' : ''}`}
                >
                  <Text
                    className={`text-sm font-semibold ${level === value ? '!text-brand-text' : ''}`}
                  >
                    {level === 'IM3' ? 'IM' : level}
                  </Text>
                  {level === value ? (
                    <Feather name="check" size={size.icon.sm} color={colors.brand.text} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
