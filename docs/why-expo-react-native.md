# 왜 Capacitor+WebView 대신 Expo(React Native)로 바꿨는가

[why-new-repo-and-partial-copy.md](why-new-repo-and-partial-copy.md)에 적힌 대로, 처음엔 기존 웹 프론트엔드의 화면/로직을 재사용하기 위해 Capacitor로 정적 빌드를 네이티브 셸에 번들링하는 웹뷰 하이브리드 방식을 택했다. 이후 세부 사항을 검토하면서 이 전제가 흔들렸다.

## 재검토하게 된 이유

1. **UI는 애초에 재사용 대상이 아니었다.** 디자인 자체가 앱 전용으로 바뀔 예정이라 웹의 UI 컴포넌트 트리는 하나도 안 가져왔다. "웹뷰라서 화면을 재사용한다"는 이점이 처음부터 실제로는 적용되지 않고 있었다.
2. **마이크 녹음도 그대로 재사용이 어려웠다.** `MediaRecorder`/`getUserMedia` 기반 웹 코드는 WebView 안에서 앱이 백그라운드로 전환되거나 메모리 압박을 받을 때 JS 컨텍스트가 일시정지/종료될 수 있어 안정성이 떨어진다. 그래서 이 부분만 네이티브로 재구현하기로 했었는데(iOS `AVAudioRecorder` 등), 이러면 "웹 코드가 WebView에서도 그대로 동작해서 재사용한다"던 원래 이유가 이 기능에서도 사라진다.
3. **결국 재사용되는 건 API 통신 레이어뿐이었다.** 타입 정의, `apiFetch` 래퍼, `Raw* → domain` 매퍼, 채점 진행 폴링 훅, API 엔드포인트 함수들 — 전부 DOM에 의존하지 않는 순수 TS/React 로직이다. 이 로직은 WebView가 아니어도, React Native(JS 엔진 + React 훅 패러다임)에서도 거의 그대로 재사용된다. 즉 "웹뷰를 써야 로직을 재사용할 수 있다"는 전제 자체가 틀렸다.
4. **웹뷰를 유지하는 대가가 계속 쌓이고 있었다.** 애플 심사 가이드라인 4.2(Minimum Functionality) 반려 리스크, 마이크 안정성 확보를 위한 네이티브 우회, 네비게이션 전환을 네이티브처럼 보이게 하기 위한 CSS 트릭 등 — 전부 "WebView인데 네이티브처럼 보이게 만드는" 작업이었다. React Native는 애초에 네이티브 위젯을 그리는 방식이라 이 문제들이 구조적으로 발생하지 않는다.

## 왜 Flutter가 아니라 React Native인가

Flutter는 자체 렌더링 엔진(Skia/Impeller)으로 모든 걸 직접 그려서 iOS/Android UI가 기본적으로 동일하게 보인다는 장점이 있지만, Dart라는 새 언어와 완전히 다른 프레임워크 구조를 요구한다. 그러면 위 3번에서 재사용하려던 API/매퍼/훅 레이어까지 포함해서 사실상 전부 새로 짜야 한다. React Native는 같은 언어(TypeScript)와 같은 패러다임(React, 훅)을 쓰기 때문에 이 로직 레이어를 그대로 옮길 수 있다는 게 결정적 차이였다.

플랫폼별 렌더링 차이(그림자 문법, 터치 피드백, 텍스트 세로 여백 등)는 실제로 존재하지만, 대부분 테마/공통 스타일 레이어에서 한 번 처리해두면 되는 잘 알려진 이슈들이라 크게 부담되는 비용은 아니라고 판단했다.

## 왜 bare RN이 아니라 Expo인가

- **EAS Build**: iOS 빌드에 필수인 Mac이 팀 전원에게 있지 않아도, 클라우드 빌드로 iOS 앱을 만들 수 있다.
- **EAS Update**: OTA로 JS/에셋만 업데이트할 수 있어(핵심 기능 추가가 아닌 범위 내에서), 매번 스토어 재심사를 거치지 않아도 되는 경우가 생긴다.
- **Expo Go / Development Build**: Xcode/Android Studio 없이 QR코드 스캔만으로 실기기 테스트가 가능해서, 개발 중 멘토 테스트 공유도 쉽다.
- **공식 관리 라이브러리**: 카메라/오디오/알림 등 자주 쓰는 기능이 Expo 팀이 직접 관리하는 1차 라이브러리(`expo-audio` 등)로 제공돼서, 아무 커뮤니티 패키지보다 네이티브 레벨 에러가 날 확률이 낮다.
- **config plugin**: 네이티브 설정을 `app.json`에 선언적으로 적으면 빌드 시 반영돼서, Xcode/Android Studio 프로젝트 파일을 직접 열어 손댈 일이 거의 없다.

과거엔 "Expo는 제약이 많아 진짜 앱엔 부적합"하다는 인식이 있었지만, 지금은 `expo prebuild`로 언제든 네이티브 프로젝트를 꺼내 bare RN처럼 직접 수정할 수 있어 그 제약이 크게 줄었다. 네이티브 모바일 전담 인력이 없는 지금 팀 상황에서는 Expo로 시작하는 게 합리적이라고 판단했다.

## 전환 시점

이 결정은 Capacitor 설치나 UI 작업을 시작하기 전, Vite 기본 템플릿에 API/타입/매퍼 레이어만 이식된 상태에서 내려졌다. 그래서 전환 비용이 거의 없었다 — 버릴 Capacitor 설정도, 다시 짤 웹뷰 화면도 없었다.

## 실제로 바뀐 것

- `vite.config.ts`, `index.html`, Vite용 `tsconfig.*` 제거. Expo 스캐폴드의 `app.json`, `App.tsx`, `index.ts`, `tsconfig.json`(`expo/tsconfig.base` 확장)로 대체.
- `@/*` → `./src/*` 별칭을 `tsconfig.json`(타입 체크)과 `babel.config.js`의 `babel-plugin-module-resolver`(런타임 번들링) 양쪽에 등록. Vite는 이걸 `vite.config.ts` 하나로 처리했지만 Metro 번들러는 tsconfig의 `paths`를 자동으로 읽지 않아서 별도 babel 플러그인이 필요하다.
- `src/lib/api/client.ts`: `import.meta.env.VITE_API_BASE_URL` → `process.env.EXPO_PUBLIC_API_BASE_URL`. Expo는 `EXPO_PUBLIC_` 접두사 붙은 변수만 클라이언트 번들에 노출한다(Vite의 `VITE_` 접두사와 동일한 역할, 문법만 다름).
- `react-router-dom`, `react-dom`, `vite` 등 DOM 기반 패키지 제거. 네비게이션 라이브러리(React Navigation, Expo Router 등)는 아직 미정 — 다음 결정 사항.
- `public/`의 마스코트/오디오 에셋은 그대로 뒀지만, RN에서는 웹처럼 URL 경로로 서빙되지 않고 `require()`/`import`로 직접 불러와야 한다는 점은 실제 화면을 만들 때 반영해야 한다.
