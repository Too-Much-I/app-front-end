import { useCallback } from 'react';
import { Alert } from 'react-native';

import { appAuthRuntime } from '@/features/auth/app-auth-runtime';

/** 잘못 눌러 다시 로그인하는 불편을 막으려고 한 번 확인한다(2026-10-06 결정). */
export function useSignOutConfirmation(): () => void {
  return useCallback(() => {
    Alert.alert('로그아웃할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void appAuthRuntime.coordinator.signOut();
        },
      },
    ]);
  }, []);
}
