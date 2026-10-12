import type { ReactNode } from 'react';

import { CrashBoundary, type BackNavigation } from '@/components/ui/CrashBoundary';

/**
 * navigator의 `screenLayout`에 넘긴다. 화면마다 경계를 하나씩 둬, 한 화면의 크래시가 탭 바나
 * 다른 화면까지 대체 화면으로 덮지 않게 한다. 훅을 쓰지 않아 함수로 불려도 된다.
 */
export function ScreenCrashLayout({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: BackNavigation;
}) {
  return (
    <CrashBoundary scope="screen" navigation={navigation}>
      {children}
    </CrashBoundary>
  );
}
