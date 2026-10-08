import { AppUpdateConnectionModal } from '@/features/app-version/components/AppUpdateConnectionModal';
import { AppUpdateRequiredModal } from '@/features/app-version/components/AppUpdateRequiredModal';
import { openAppStorePage } from '@/features/app-version/app-store-page';
import { useAppUpdateCheck } from '@/features/app-version/use-app-update-check';

/**
 * 앱 버전 확인의 전역 오버레이. `PortraitOnlyNotice`처럼 `NavigationContainer` 바깥에 둔다.
 *
 * 확인 훅을 이 안에서 호출하는 이유: `App.tsx`에서 호출하면 확인 상태가 바뀔 때마다 앱 트리 전체가 리렌더된다.
 */
export function AppUpdateNotice() {
  const { state, platform, retry, dismiss } = useAppUpdateCheck();
  if (platform === null) return null;

  return (
    <>
      <AppUpdateRequiredModal
        platform={platform}
        visible={state.status === 'required'}
        // 스토어를 열지 못해도 강제 화면에 그대로 머문다. 다시 누를 수 있다.
        onOpenStore={() => void openAppStorePage(platform).catch(() => undefined)}
      />
      <AppUpdateConnectionModal
        retrying={state.status === 'checking'}
        visible={
          state.status === 'connection-failed' ||
          (state.status === 'checking' && state.noticeVisible)
        }
        onDismiss={dismiss}
        onRetry={retry}
      />
    </>
  );
}
