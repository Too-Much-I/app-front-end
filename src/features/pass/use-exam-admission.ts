import { useFocusEffect } from '@react-navigation/native';
import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getExamAdmission } from '@/features/pass/api/entitlements';

/**
 * 모의고사 진입 확인. 이용권은 결제·만료·시험으로 바뀌므로 캐시를 믿지 않고 준비 화면에 들어올 때마다
 * 다시 읽는다. 계정이 바뀌면 인증 런타임이 쿼리 캐시를 통째로 비운다.
 */
export function examAdmissionQueryOptions() {
  return queryOptions({
    queryKey: ['entitlements', 'exam-admission'] as const,
    queryFn: ({ signal }) => getExamAdmission(signal),
    staleTime: 0,
    retry: false,
  });
}

export function useExamAdmission() {
  const query = useQuery(examAdmissionQueryOptions());
  const { refetch } = query;

  // 탭 화면은 마운트된 채 남아서 다시 들어올 때의 재조회 계기를 포커스로 둔다.
  useFocusEffect(
    useCallback(() => {
      void refetch({ cancelRefetch: false });
    }, [refetch]),
  );

  return query;
}
