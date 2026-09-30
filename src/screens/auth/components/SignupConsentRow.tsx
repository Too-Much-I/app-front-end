import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size } from '@/theme';

interface SignupConsentRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  onDetail?: () => void;
  all?: boolean;
  /** 선택 동의. 라벨에 [선택]을 붙인다. */
  optional?: boolean;
  disabled?: boolean;
}

export function SignupConsentRow({
  label,
  checked,
  onToggle,
  onDetail,
  all = false,
  optional = false,
  disabled = false,
}: SignupConsentRowProps) {
  const tag = optional ? '선택' : '필수';
  return (
    <View
      className={`flex-row items-center ${all ? 'rounded-control border border-line bg-surface' : ''}`}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={all ? label : `${tag} ${label}`}
        disabled={disabled}
        className={`flex-1 flex-row items-center gap-element px-card ${all ? 'min-h-control-lg py-element' : 'min-h-control-md py-sm'}`}
        onPress={onToggle}
      >
        <View
          className={`h-6 w-6 items-center justify-center rounded-chip border ${checked ? 'border-brand bg-brand' : 'border-ink-disabled bg-surface'}`}
        >
          {checked ? (
            <Feather name="check" size={size.icon.sm} color={colors.surface.DEFAULT} />
          ) : null}
        </View>
        <Text className={`flex-1 ${all ? 'text-lg' : 'text-base'}`}>
          {!all ? (
            <Text className={optional ? 'text-ink-muted' : 'text-brand-text'}>[{tag}] </Text>
          ) : null}
          {label}
        </Text>
      </Pressable>
      {onDetail ? (
        <Pressable
          accessibilityLabel={`${label} 자세히 보기`}
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          onPress={onDetail}
        >
          <Feather name="chevron-right" size={size.icon.md} color={colors.ink.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
