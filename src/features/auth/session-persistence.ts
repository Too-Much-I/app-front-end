import type { AuthRestorationRecord } from "@/features/auth/session-restoration-types";
import type { AuthSession } from "@/features/auth/types";

// 앱 실행 중 저장만 재시도한다. 서버의 토큰 발급 요청을 반복하지 않는다.
const STORAGE_RETRY_DELAYS_MS = [1_000, 3_000, 10_000] as const;

export function createSessionPersistence(
  write: (record: AuthRestorationRecord) => Promise<void>,
) {
  let revision = 0;
  let queue: Promise<void> = Promise.resolve();
  let dirty: AuthRestorationRecord | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryIndex = 0;
  let running = false;
  let disposed = false;

  function cancelRetry(): void {
    revision += 1;
    dirty = null;
    retryIndex = 0;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function enqueue(
    record: AuthRestorationRecord,
    version: number,
  ): Promise<void> {
    const operation = queue.then(async () => {
      if (!disposed && version === revision) await write(record);
    });
    // 모든 저장을 직렬화해 이전 쓰기가 최신 세션을 뒤늦게 덮어쓰지 않게 한다.
    queue = operation.catch(() => {});
    return operation;
  }

  async function flush(): Promise<void> {
    if (disposed || running || !dirty) return;
    const record = dirty;
    const version = revision;
    running = true;
    try {
      await enqueue(record, version);
      if (version === revision) dirty = null;
    } catch {
      const delay = STORAGE_RETRY_DELAYS_MS[retryIndex];
      if (!disposed && version === revision && delay !== undefined) {
        retryIndex += 1;
        timer = setTimeout(
          () => {
            timer = null;
            void flush();
          },
          delay + Math.floor(Math.random() * delay * 0.2),
        );
      }
    } finally {
      running = false;
      // 처리 중 새 세션이 들어오면 예전 실패·타이머 대신 최신 레코드를 저장한다.
      if (!disposed && version !== revision && dirty) void flush();
    }
  }

  function saveInBackground(session: AuthSession): void {
    cancelRetry();
    dirty = { schemaVersion: 2, phase: "active", session };
    void flush();
  }

  function retryPersistence(): void {
    if (disposed || !dirty || running) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    retryIndex = 0;
    void flush();
  }

  function writeRequired(record: AuthRestorationRecord): Promise<void> {
    cancelRetry();
    return enqueue(record, revision);
  }

  function dispose(): void {
    disposed = true;
    cancelRetry();
  }

  return { saveInBackground, writeRequired, retryPersistence, dispose };
}
