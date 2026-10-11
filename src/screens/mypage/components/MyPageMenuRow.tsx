import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors } from '@/theme';

interface MyPageMenuRowProps {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  onPress: () => void;
  showDivider?: boolean;
}

/**
 * 마이페이지 아래 메뉴 한 줄.
 *
 * 설정의 `SettingsRow`와 모양을 맞췄지만 가져다 쓰지 않는다. 화면 영역끼리 import하지 않는
 * 규칙(`check:architecture`)이 있고, 두 화면의 행은 함께 바뀔 이유가 없다.
 */
export function MyPageMenuRow({
  icon,
  title,
  description,
  onPress,
  showDivider = true,
}: MyPageMenuRowProps) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 py-4 ${showDivider ? 'border-b border-line' : ''}`}
      onPress={onPress}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
        <Feather color={colors.brand.DEFAULT} name={icon} size={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-base">{title}</Text>
        {description ? <Text className="mt-1 text-xs text-ink-muted">{description}</Text> : null}
      </View>
      <Feather color={colors.ink.disabled} name="chevron-right" size={20} />
    </Pressable>
  );
}
