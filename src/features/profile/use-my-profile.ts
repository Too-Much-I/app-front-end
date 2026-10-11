import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { myProfileQueryOptions } from '@/features/profile/my-profile-queries';

/**
 * 내 프로필. 한 번 받으면 다시 읽지 않고, 아직 받지 못했을 때만 화면에 들어올 때 다시 읽는다.
 *
 * 탭 화면은 마운트된 채 남아서 "다시 마운트될 때 재조회"가 일어나지 않는다. 그래서 실패한 뒤의
 * 재시도 계기를 포커스로 둔다(마이페이지 이력과 같은 "다음 진입" 규칙).
 */
export function useMyProfile() {
  const query = useQuery(myProfileQueryOptions());
  const { data, refetch } = query;
  const hasProfile = data !== undefined;

  useFocusEffect(
    useCallback(() => {
      if (!hasProfile) void refetch({ cancelRefetch: false });
    }, [hasProfile, refetch]),
  );

  return query;
}
