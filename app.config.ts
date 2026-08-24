import type { ConfigContext } from 'expo/config';

import { version } from './package.json';

// 앱 설정 본문은 app.json에 그대로 두고, 버전만 package.json에서 가져온다.
// 사용자에게 보이는 버전의 출처를 한 곳에 모아, 릴리스 태그와 대조할 기준값을
// 만든다. 대조하는 검사 자체는 아직 없다 — 릴리스 워크플로를 만들 때 붙인다.
//
// 반환 타입을 ExpoConfig로 적지 않는다. ConfigContext의 config는 name·slug가
// 선택 속성이라 ExpoConfig에 대입되지 않는데, 맞추려면 app.json에 이미 있는 값을
// 여기에 다시 적어야 한다. 출처를 하나로 모으려는 이 파일의 목적과 반대다.
export default ({ config }: ConfigContext) => ({
  ...config,
  version,
});
