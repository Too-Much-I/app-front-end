import { Platform } from 'react-native';

import type { PushInstallation } from '@/features/push/push-installation';
import type { PushPermission } from '@/features/push/push-permission';
import type { JsonRequestInit } from '@/lib/api/transport';

/** Learning Core 요청. 인증 runtime의 `api.apiFetch`를 받는다(`lib/api/client`는 runtime을 import해 순환이 된다). */
export type LearningApiFetch = <T>(path: string, init?: JsonRequestInit) => Promise<T>;

export type PushDeviceReport = {
  pushToken: string;
  permission: PushPermission;
  /** 권한을 읽은 시각. 서버는 이보다 오래된 관측을 409로 거절한다. */
  permissionObservedAt: string;
};

const DEVICES_PATH = '/api/v1/notifications/devices';

/** 등록·토큰 갱신·권한 보고 공용(`PUT /api/v1/notifications/devices`). 로그인한 계정에 이 설치를 연결한다. */
export async function putPushDevice(
  apiFetch: LearningApiFetch,
  installation: PushInstallation,
  report: PushDeviceReport,
): Promise<void> {
  await apiFetch<unknown>(DEVICES_PATH, {
    method: 'PUT',
    headers: { 'X-Installation-Secret': installation.secret },
    body: JSON.stringify({
      installationId: installation.installationId,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      pushToken: report.pushToken,
      permission: report.permission,
      permissionObservedAt: report.permissionObservedAt,
    }),
  });
}

/** 이 설치의 계정 연결을 끊는다. 없는 설치도 200이다. */
export async function deletePushDevice(
  apiFetch: LearningApiFetch,
  installation: PushInstallation,
): Promise<void> {
  await apiFetch<unknown>(`${DEVICES_PATH}/${installation.installationId}`, {
    method: 'DELETE',
    headers: { 'X-Installation-Secret': installation.secret },
  });
}
