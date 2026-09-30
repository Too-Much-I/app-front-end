import { AppState } from 'react-native';

export type AuthForegroundRecoveryState = 'busy' | 'retryable' | 'settled';

/** 복귀당 한 번. 복귀 전에 시작한 작업이 나중에 실패하는 경우도 관찰한다. */
export function observeAuthForegroundRecovery(options: {
  getState: () => AuthForegroundRecoveryState;
  subscribe: (listener: () => void) => () => void;
  retry: () => Promise<void>;
}): () => void {
  let appState = AppState.currentState;
  let armed = appState === 'background' || appState === 'inactive';
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function evaluate(): void {
    if (disposed || appState !== 'active' || !armed) return;
    const state = options.getState();
    if (state === 'settled') {
      armed = false;
      return;
    }
    if (state === 'busy' || timer !== null) return;
    // 실패 알림을 보낸 원래 작업의 finally가 끝난 뒤 재시도한다.
    timer = setTimeout(() => {
      timer = null;
      if (disposed || appState !== 'active' || !armed) return;
      if (options.getState() !== 'retryable') {
        evaluate();
        return;
      }
      armed = false;
      // 컨트롤러가 실패 UI를 소유한다. 구독 콜백에서 거부를 전파하지 않는다.
      void options.retry().catch(() => undefined);
    }, 0);
  }

  const unsubscribe = options.subscribe(evaluate);
  const subscription = AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') armed = true;
    appState = next;
    evaluate();
  });
  return () => {
    disposed = true;
    unsubscribe();
    subscription.remove();
    if (timer !== null) clearTimeout(timer);
  };
}
