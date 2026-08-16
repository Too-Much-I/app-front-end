import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export type RecordingPermissionFailureOperation =
  | "permission-check"
  | "permission-request";

export class RecordingPermissionError extends Error {
  constructor(
    public readonly operation: RecordingPermissionFailureOperation,
    cause: unknown,
  ) {
    super("마이크 권한 상태를 확인하지 못했습니다.", { cause });
    this.name = "RecordingPermissionError";
  }
}

interface ResolveRecordingPermissionOptions {
  onRequestStart?: () => void;
  onRequestEnd?: () => void;
}

/**
 * Android 16에서는 이미 허용된 권한에 request를 다시 호출하면 완료되지 않는 사례가 있다.
 * 먼저 현재 상태를 읽고 실제 사용자 승인이 필요할 때만 시스템 요청을 연다.
 */
export async function resolveRecordingPermissionAsync(
  options: ResolveRecordingPermissionOptions = {},
) {
  let currentPermission: Awaited<ReturnType<typeof getRecordingPermissionsAsync>>;

  try {
    currentPermission = await getRecordingPermissionsAsync();
  } catch (error) {
    throw new RecordingPermissionError("permission-check", error);
  }

  if (currentPermission.granted || !currentPermission.canAskAgain) {
    return currentPermission;
  }

  options.onRequestStart?.();
  try {
    return await requestRecordingPermissionsAsync();
  } catch (error) {
    throw new RecordingPermissionError("permission-request", error);
  } finally {
    options.onRequestEnd?.();
  }
}
