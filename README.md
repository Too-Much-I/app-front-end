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
