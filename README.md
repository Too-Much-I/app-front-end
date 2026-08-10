# app-front-end

Expo(React Native) 기반 모바일 앱. 왜 Capacitor+WebView 대신 Expo RN을 선택했는지는 [docs/why-expo-react-native.md](docs/why-expo-react-native.md)를 참고.

## 개발 서버 실행

```
pnpm install
pnpm start
```

터미널에 뜨는 QR코드를 폰의 Expo Go 앱(App Store/Play Store에서 무료 설치)으로 스캔하면 실기기에서 바로 확인할 수 있다. `pnpm ios`/`pnpm android`로 시뮬레이터/에뮬레이터 실행도 가능(Xcode/Android Studio 필요).

## 경로 별칭

`@/*` → `./src/*`. `tsconfig.json`(타입 체크용)과 `babel.config.js`의 `module-resolver`(런타임 번들링용) 양쪽에 등록돼 있어, 둘 중 하나만 바꾸면 타입과 실제 번들 결과가 어긋난다.

## 환경 변수

`EXPO_PUBLIC_` 접두사가 붙은 변수만 클라이언트 번들에 노출된다(`.env.local.example` 참고). Vite의 `VITE_` 접두사와 같은 역할.

### Microsoft Clarity

`EXPO_PUBLIC_ENABLE_CLARITY`가 문자열 `true`일 때만 Clarity 세션 수집을 초기화한다. 로컬과 스테이징에서는 `false` 또는 미설정 상태를 유지하고, 앱 심사용 production 빌드의 EAS 환경에서만 `true`로 설정한다.

Clarity는 네이티브 SDK이므로 Expo Go에서는 동작하지 않는다. 패키지를 처음 추가하거나 버전을 변경한 뒤 검증하려면 새 development build 또는 production build가 필요하다. 기본 화면과 사용자 상호작용은 자동 수집하며, 별도의 커스텀 이벤트는 제품 분석 요구사항이 생길 때만 추가한다.
