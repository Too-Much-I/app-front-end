import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size } from '@/theme';

type ControlAction = {
  label: string;
  caption?: string;
  icon: ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  disabled?: boolean;
};
export function LearningControls({
  primary,
  left,
  right,
  message,
  notice,
  busy = false,
}: {
  primary: ControlAction;
  left: ControlAction;
  right: ControlAction;
  message?: string | null;
  notice?: ReactNode;
  busy?: boolean;
}) {
  return (
    <View className="items-center gap-md px-screen pb-lg pt-md">
      {/* Reserve the notice area so hiding routine status never moves the controls. */}
      <View className="h-10 w-full justify-center">
        {notice ??
          (message ? (
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={2}
              className="h-10 text-center text-sm leading-5 text-ink-muted"
            >
              {message}
            </Text>
          ) : null)}
      </View>
      <View className="w-full flex-row items-center justify-center gap-lg">
        {[left, primary, right].map((action, index) => (
          <View key={index} className="w-20 items-center gap-xs">
            {/* Reserve the same 72 pt media row for every stage and button state. */}
            <View className="items-center justify-center" style={{ height: 72 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{ disabled: action.disabled || busy }}
                disabled={action.disabled || busy}
                onPress={action.onPress}
                className={`items-center justify-center rounded-pill ${index === 1 ? 'border-b-4 border-brand-600 bg-brand-cta' : ''} ${action.disabled ? 'opacity-40' : ''}`}
                // Fixed media controls: the center remains 72 pt in every learning stage.
                style={{
                  width: index === 1 ? 72 : size.hitTarget,
                  height: index === 1 ? 72 : size.hitTarget,
                }}
              >
                {busy && index === 1 ? (
                  <ActivityIndicator color={colors.surface.DEFAULT} />
                ) : (
                  <Feather
                    name={action.icon}
                    size={index === 1 ? 28 : 20}
                    color={index === 1 ? colors.surface.DEFAULT : colors.ink.muted}
                  />
                )}
              </Pressable>
            </View>
            <Text
              numberOfLines={1}
              className={`h-5 text-center text-xs font-medium leading-5 ${action.disabled ? 'text-ink-disabled' : 'text-ink-muted'}`}
            >
              {action.caption ?? action.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
