type PurchaseIdentityDependencies = {
  requestRef: () => Promise<string>;
  readStored: () => Promise<string | null>;
  store: (value: string) => Promise<void>;
  clearStored: () => Promise<void>;
  logInStore: (value: string) => Promise<void>;
  logOutStore: () => Promise<void>;
};

/**
 * 결제용 ID(`purchaseAccountRefId`)를 이 기기의 RevenueCat 사용자로 맞춘다(2026-10-13 결정).
 *
 * - 로그인·세션 복원 때 `ensure`. 결제 화면에서 처음 받으면 재시도해도 못 받을 수 있어 미리 받는다.
 *   저장된 값이 있으면 다시 받지 않는다. 결제 화면도 같은 `ensure`를 부른다.
 * - 로그인 화면에 오면 `reset`. 앱 안에 계정 전환이 없어 로그인 화면에 왔다는 것 자체가 계정이 바뀔 수 있다는
 *   뜻이다. 남은 값으로 다른 회원이 결제하면 이전 회원에게 이용권이 붙는다.
 *
 * 둘은 부른 순서대로 한 줄로 실행한다. A의 `ensure`가 늦게 끝나도 뒤에 온 `reset`이 지우고, `reset`이 늦게
 * 끝나도 그 뒤의 B `ensure`가 다시 받는다. 진행 중이거나 대기 중인 `ensure`는 함께 쓴다 — 단, `reset` 앞에
 * 줄 선 것은 이전 회원 것이라 `reset` 뒤에 부르면 새로 줄 세운다.
 */
export function createPurchaseIdentity(dependencies: PurchaseIdentityDependencies) {
  let tail: Promise<unknown> = Promise.resolve();
  let queuedEnsure: Promise<string> | null = null;
  /** 이번 실행에서 RevenueCat에 로그인시킨 값. 있으면 저장소도 SDK도 다시 보지 않는다. */
  let current: string | null = null;

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  }

  async function establish(): Promise<string> {
    if (current) return current;
    const stored = await dependencies.readStored();
    const value = stored ?? (await dependencies.requestRef());
    if (!stored) {
      // 저장에 실패해도 이번 결제는 막지 않는다. 다음 실행이 다시 받는다.
      await dependencies.store(value).catch(() => undefined);
    }
    await dependencies.logInStore(value);
    current = value;
    return value;
  }

  /** 결제용 ID를 확보하고 RevenueCat 사용자를 맞춘다. 실패하면 던진다 — 결제 화면은 결제를 시작하지 않는다. */
  function ensure(): Promise<string> {
    if (queuedEnsure) return queuedEnsure;
    const run = enqueue(establish).finally(() => {
      if (queuedEnsure === run) queuedEnsure = null;
    });
    queuedEnsure = run;
    return run;
  }

  /** 저장값과 RevenueCat 사용자를 비운다. 던지지 않는다 — 로그인 화면을 막지 않는다. */
  function reset(): Promise<void> {
    queuedEnsure = null;
    return enqueue(async () => {
      current = null;
      await Promise.allSettled([dependencies.clearStored(), dependencies.logOutStore()]);
    });
  }

  return { ensure, reset };
}
