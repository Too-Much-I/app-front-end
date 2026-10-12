import { Feather } from '@expo/vector-icons';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size, spacing } from '@/theme';

type MeaningPair = { english: string; korean: string };

/** A shared bottom sheet keeps translation controls out of the learning cards. */
export function LearningTranslationSheet({
  visible,
  onClose,
  question,
  sentence,
}: {
  visible: boolean;
  onClose: () => void;
  question?: MeaningPair;
  sentence?: MeaningPair;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sections = [
    ...(question ? [{ label: '문제', ...question }] : []),
    ...(sentence ? [{ label: '현재 문장', ...sentence }] : []),
  ];
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-black/30"
          accessibilityRole="button"
          accessibilityLabel="해석 닫기"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="overflow-hidden rounded-t-card bg-surface"
          style={{ maxHeight: height * 0.75, paddingBottom: Math.max(insets.bottom, spacing.md) }}
        >
          <View className="flex-row items-center justify-between px-screen pb-sm pt-md">
            <Text accessibilityRole="header" className="text-lg font-semibold">
              해석
            </Text>
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-pill"
              accessibilityRole="button"
              accessibilityLabel="해석 창 닫기"
              onPress={onClose}
            >
              <Feather name="x" size={size.icon.md} color={colors.ink.DEFAULT} />
            </Pressable>
          </View>
          <ScrollView
            bounces={false}
            className="shrink"
            contentContainerClassName="gap-xl px-screen pb-lg"
            showsVerticalScrollIndicator
          >
            {sections.map(({ label, english, korean }, index) => (
              <View
                key={label}
                className={`gap-sm ${index > 0 ? 'border-t border-learning-paperLine pt-lg' : ''}`}
              >
                <Text className="text-xs font-semibold !text-brand-text">{label}</Text>
                <Text className="text-sm leading-6 text-ink-muted">{english}</Text>
                <Text className="text-base leading-7" lineBreakStrategyIOS="hangul-word">
                  {korean}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
