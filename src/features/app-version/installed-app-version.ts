import * as Application from 'expo-application';

/**
 * 설치된 앱 버전을 화면에 쓰는 모양으로. 설정과 마이페이지가 같은 표기를 쓴다.
 *
 * 네이티브 값을 읽지 못하면(웹·일부 개발 빌드) `확인 불가`다.
 */
export function formatInstalledAppVersion(): string {
  const version = Application.nativeApplicationVersion;
  if (!version) return '확인 불가';
  return version.startsWith('v') ? version : `v${version}`;
}
