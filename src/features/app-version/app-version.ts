/**
 * 설치 버전과 서버 최소 버전을 비교한다.
 *
 * `unknown`은 판단할 근거가 없다는 뜻이고 통과로 다룬다. 서버 값이 없거나(503·미배포) 어느 쪽이든
 * `major.minor.patch`로 읽을 수 없을 때다(2026-10-08 결정: 정책이 확정되지 않았으면 막지 않는다).
 */
export type AppUpdateDecision = 'required' | 'not-required' | 'unknown';

type AppVersionParts = readonly [major: number, minor: number, patch: number];

const APP_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseAppVersion(value: string): AppVersionParts | null {
  const match = APP_VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isBelow(installed: AppVersionParts, minimum: AppVersionParts): boolean {
  for (let index = 0; index < installed.length; index += 1) {
    if (installed[index] !== minimum[index]) return installed[index] < minimum[index];
  }
  return false;
}

export function decideAppUpdate(
  installedVersion: string | null,
  minimumVersion: string | null,
): AppUpdateDecision {
  if (installedVersion === null || minimumVersion === null) return 'unknown';
  const installed = parseAppVersion(installedVersion);
  const minimum = parseAppVersion(minimumVersion);
  if (!installed || !minimum) return 'unknown';
  return isBelow(installed, minimum) ? 'required' : 'not-required';
}
