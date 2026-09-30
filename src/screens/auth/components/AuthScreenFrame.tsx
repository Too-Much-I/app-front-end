import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { Pressable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { colors, size } from '@/theme';

interface AuthScreenFrameProps {
  title: string;
  step: 1 | 2;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/** Safe area는 인증 흐름의 root가 소유한다. 키보드가 올라오면 입력과 하단 행동을 함께 올린다. */
export function AuthScreenFrame({ title, step, onBack, children, footer }: AuthScreenFrameProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-surface-subtle"
    >
      <View className="min-h-control-lg flex-row items-center justify-between px-screen">
        <Pressable
          accessibilityLabel="이전 화면"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          onPress={onBack}
        >
          <Feather name="chevron-left" size={size.icon.lg} color={colors.ink.DEFAULT} />
        </Pressable>
        <Text accessibilityRole="header" className="text-xl">
          {title}
        </Text>
        <View
          accessibilityLabel={`가입 ${step}/2단계`}
          className="w-11 flex-row justify-end gap-xs"
        >
          <View
            className={`h-2 rounded-pill ${step === 1 ? 'w-6 bg-brand' : 'w-2 bg-brand-200'}`}
          />
          <View
            className={`h-2 rounded-pill ${step === 2 ? 'w-6 bg-brand' : 'w-2 bg-brand-200'}`}
          />
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-screen pb-section pt-section"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <View className="px-screen pb-element pt-card">{footer}</View>
    </KeyboardAvoidingView>
  );
}
