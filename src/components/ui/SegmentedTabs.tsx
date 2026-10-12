import { useContext } from 'react';
import { View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { shadows } from '@/theme';
import { TypographyContext } from '@/theme/typography-context';

/** A single selection control, visually distinct from the page's primary action. */
export function SegmentedTabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { value: T; label: string; disabled?: boolean; badge?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const systemFont = useContext(TypographyContext) === 'system';
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className="flex-row rounded-control bg-learning-category p-xs"
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityLabel={item.badge ? `${item.label}, ${item.badge}` : item.label}
            accessibilityState={{ selected, disabled: item.disabled }}
            disabled={item.disabled}
            onPress={() => onChange(item.value)}
            className={`min-h-11 flex-1 flex-row items-center justify-center gap-sm rounded-xl px-xs ${selected ? 'bg-surface' : ''}`}
            style={selected ? shadows.card : undefined}
          >
            <Text
              className={`text-sm ${systemFont ? 'font-semibold' : ''} ${selected ? '!text-brand-text' : 'text-ink-muted'}`}
            >
              {item.label}
            </Text>
            {item.badge ? (
              <View className="rounded-pill bg-line px-sm py-xs">
                <Text className={`text-xs ${systemFont ? 'font-medium' : ''}`}>{item.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
