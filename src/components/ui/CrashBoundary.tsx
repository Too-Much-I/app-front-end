import type { ReactNode } from 'react';

import { CrashFallback } from '@/components/ui/CrashFallback';
import { SentryErrorBoundary } from '@/lib/sentry';

/** 경계가 어디서 잡았는지. 화면 경계를 지나 최상단까지 올라왔다면 화면 밖(provider·오버레이) 크래시다. */
type CrashBoundaryScope = 'app' | 'screen';

/** 화면 경계가 쓰는 내비게이션. `screenLayout`이 넘기는 navigation 객체를 구조로 받는다. */
export interface BackNavigation {
  canGoBack(): boolean;
  goBack(): void;
}

/**
 * 렌더 크래시를 잡아 Sentry에 보내고 대체 화면을 그린다(2026-10-11 결정: 최상단 + 화면마다).
 *
 * componentStack은 경계 위치와 상관없이 throw한 컴포넌트부터 쌓이므로, 경계 위치는 "어디까지
 * 대체 화면으로 바꾸느냐"만 정한다.
 */
export function CrashBoundary({
  scope,
  navigation,
  children,
}: {
  scope: CrashBoundaryScope;
  /** 화면 경계만 넘긴다. 뒤로 갈 곳이 있으면 "뒤로 가기", 없으면 다시 그린다. */
  navigation?: BackNavigation;
  children: ReactNode;
}) {
  return (
    <SentryErrorBoundary
      beforeCapture={(sentryScope) => {
        sentryScope.setTag('crash_boundary', scope);
      }}
      fallback={({ resetError }) => (
        <CrashFallback
          action={
            navigation?.canGoBack()
              ? { kind: 'go-back', onPress: () => navigation.goBack() }
              : { kind: 'retry', onPress: resetError }
          }
        />
      )}
    >
      {children}
    </SentryErrorBoundary>
  );
}
