# Firebase Auth SDK 설치와 스켈레톤 작성

2026-09-28 확인. Firebase 컨트롤러 및 SDK 어댑터를 구현했고, 2026-09-29 로컬 Firebase 프로젝트 파일과 네이티브 설정을 연결했다. 실제 계정 인증 성공 여부는 별도 검증한다.

## 설치한 버전과 근거

| 항목 | 현재 값 | 확인 근거 |
| --- | --- | --- |
| Expo / React Native | 57.0.11 / 0.86.2 | 프로젝트 package.json |
| Firebase App / Auth | 둘 다 **26.4.0**, exact 고정 | 공식 npm 배포의 latest 및 peerDependencies |
| Expo peer 조건 | >=47.0.0 | App/Auth 26.4.0 package.json |
| Auth → App 조건 | App 26.4.0 | Auth 26.4.0 package.json |
| Firebase 네이티브 버전 | Apple 12.18.0 / Android BoM 34.18.0 | App 26.4.0 sdkVersions |
| iOS 조건 | SDK 최소 iOS 15.0, 현재 앱 16.4 | sdkVersions 및 ios/Podfile |
| Xcode 조건 | 공식 안내 26.2 이상, 로컬 26.6 | RNFirebase 설치 가이드 및 xcodebuild |

공식 문서는 Expo와 development build를 지원한다고 안내한다. 특정 Expo 57 + RN 0.86.2 조합의 인증 완료를 보증하는 호환표는 아니다. 패키지 peer 조건 확인과 실제 iOS/Android 빌드 검증은 구분한다.

Expo 가이드는 JS SDK와 네이티브 SDK 두 경로를 제공한다. 이 앱은 네이티브 앱이고 `expo-dev-client`가 이미 있으며, SNS 사용자에 Phone credential을 연결해야 하므로 React Native Firebase를 설치했다. 브라우저용 `firebase`를 직접 의존성으로 추가하지 않았다. RNFirebase의 전이 의존성으로는 포함된다.

```sh
pnpm add --save-exact @react-native-firebase/app@26.4.0 @react-native-firebase/auth@26.4.0
```

pnpm 설치 스크립트 정책에는 `@firebase/util`, `protobufjs`를 false로 명시했다. 전자는 Web App Hosting 자동 설정 생성용이고 배포본에 기본 구현이 있으며, 후자는 버전 표기 경고용이라 현재 네이티브 앱에 필요하지 않다. 다른 패키지의 스크립트 정책은 유지한다.

## 연결 전에 필요한 설정

- Firebase 콘솔의 iOS/Android 앱을 `com.toteacher.app`에 맞춰 등록하고 `GoogleService-Info.plist` / `google-services.json`을 준비한다. 서버용 서비스 계정 private key를 앱에 넣는 작업이 아니다.
- app config의 `ios.googleServicesFile`, `android.googleServicesFile`와 App/Auth config plugin을 연결한다. 현재 로컬 파일은 `config/firebase/`에 두고 `app.config.ts`에 연결했다.
- 26.4.0의 기본 SPM은 dynamic frameworks를 요구한다. 이 앱은 native 의존성을 CocoaPods로 통일하도록 App plugin에 `ios.disableSPM: true`, build-properties에 static frameworks와 RNFBApp/RNFBAuth의 forceStaticLinking을 설정했다. SPM 기본 모드와 static을 섞지 않는다.
- SNS별 Firebase Provider 활성화, Google OAuth client·Android 서명 설정, Apple 설정 등을 확인하고 필요한 Provider SDK를 그때 설치한다. App/Auth만 설치해 Google·Apple·Kakao 버튼이 자동 동작하지는 않는다. 이전에는 Kakao OIDC가 설정됐다는 전달을 받았으나, 2026-09-29 사용자가 확인한 현재 프로젝트 목록에는 Google·Apple·전화만 활성화돼 있다. Kakao는 미설정으로 취급하고 검증 화면에서 비활성화한다.
- Phone Auth의 iOS 앱 검증/APNs·reCAPTCHA, Android Play Integrity·reCAPTCHA 및 SMS 테스트 설정을 확인한다.
- 설정 후 development build를 재생성·설치한다. 기존 개발 클라이언트에는 새 네이티브 모듈이 없다. Expo Go는 지원하지 않는다. `expo prebuild --no-install` 실행으로 native 프로젝트가 재생성되었다. 생성된 파일을 직접 수정하지 않는다.

## 구현된 연결 방법

스켈레톤을 [정식 컨트롤러](../src/features/auth/firebase-auth-controller.ts)로 대체했다. 사용자 결정과 뼈대 대비 차이는 [결정 기록](decisions/2026-09-28-Firebase-본인-인증-컨트롤러.md)에 정리했다.

아래는 Firebase 프로젝트·네이티브 설정을 마친 뒤 앱 단위로 한 번 생성할 연결 예시다. 현재 기본 앱 경로에서는 생성하지 않고, 개발 인증 검증 화면에서만 생성한다. 값은 실제 환경의 설정을 사용한다.

```ts
const firebase = createFirebaseAuthController(createFirebaseAuthSdk({
  google: { webClientId, iosClientId },
  apple: { enabled: true },
  kakao: { providerId: kakaoOidcProviderId },
}));
const result = await firebase.signIn("kakao");
// proof-ready → 코디네이터가 Identity exchange 또는 guest/prepare 실행
// cancelled → 로그인 화면 복귀
// failed → reason과 nextAction으로 안내
// ignored → 기존 실행을 유지하며 후속 처리를 하지 않음
```

- `firebase.retry()`: nextAction이 retry인 실패 단계부터 재개한다. sign-in-again은 `signIn(provider)`로 새 인증을 시작한다.
- `firebase.cancel()`: 호출 중인 signIn/retry를 cancelled로 즉시 완료하고 progress를 초기화한다. 실제 SDK가 끝날 때까지 새 인증·재시도는 busy로 무시한다.
- `firebase.getState().operation` / `subscribe`: running은 인증 진행, cancelling은 이전 native 작업 종료 대기를 표시한다. 새 로그인 버튼은 두 상태에서 비활성화한다.
- 이 Zustand 상태에는 User·Token이 없다. `proof-ready`의 Token은 코디네이터에 반환하며 영속 저장하지 않는다. progress의 user는 controller 메모리에만 보관한다.
- SDK 모듈의 초기화와 Firebase Provider의 실제 사용 가능 여부는 별개다. 설정하지 않은 Provider는 provider-unavailable로 실패한다.

Google Sign-In 16.1.5와 Expo Apple Authentication 57.0.1을 추가했다. Google은 native sign-in 후 Firebase credential 교환, Apple은 iOS native 인증과 Android Firebase 웹 인증, Kakao는 Firebase OIDC 인증을 사용한다. iOS Apple에는 해시한 nonce를 전달하고 Firebase에는 원래 nonce를 전달한다.

네이티브 연결 시 Google Sign-In·Expo Apple Authentication config plugin과 iOS `usesAppleSignIn`, Google 복귀 URL scheme, Firebase Auth의 OIDC 복귀 설정을 함께 적용해야 한다. 현재 이 native 설정들은 app.config.ts의 plugin으로 연결했다. 기본 서비스 로그인 경로는 아직 구버전이다.

RNFirebase 26.4.0은 `OAuthProvider.providerId`의 private 선언과 modular API의 public AuthProvider 타입이 어긋난다. `firebase-auth-sdk.ts` 한 곳에서 `PROVIDER_ID`와 `toObject()`를 가진 객체로 변환한다. `any`나 타입 검사 억제는 사용하지 않는다.

전화번호 입력·SMS 재전송·자동 인증·동일 UID에 credential 연결은 다음 범위다. 기존 사용자에게 전화번호를 연결할 때 `signInWithPhoneNumber`로 다른 Firebase 사용자에 로그인하는 흐름을 사용하지 않는다.

## 공식 근거

- [Google Sign-In 공식 SDK 사용법](https://react-native-google-signin.github.io/docs/original)
- [Expo Apple Authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- [Expo: Using Firebase](https://docs.expo.dev/guides/using-firebase/)
- [React Native Firebase: Expo 설치 및 요구사항](https://rnfirebase.io/)
- [React Native Firebase: Phone Authentication — Secondary Authentication](https://rnfirebase.io/auth/phone-auth)
- [App 공식 배포 메타데이터](https://registry.npmjs.org/@react-native-firebase%2Fapp/26.4.0)
- [Auth 공식 배포 메타데이터](https://registry.npmjs.org/@react-native-firebase%2Fauth/26.4.0)

메서드 시그니처는 설치된 26.4.0의 `auth/lib/index.ts`에서도 확인했다. `verifyPhoneNumber`는 이벤트 listener를 반환하므로 단순 SMS Promise로 가정하지 않는다.

## 이번 검증 결과

- 컨트롤러 구현 후 Firebase 회귀 검사 17개, 기존 세션 복원 검사 20개, lint·TypeScript·architecture·naming 검사를 통과했다.

- `pnpm install --frozen-lockfile`, SDK 설치 버전 조회, lint·TypeScript·architecture·naming·diff 검사 통과. architecture 경고는 이전 작업과 동일한 24건이다.
- `pnpm peers check`: Firebase peer 충돌은 없으며, 기존 navigation의 native 7.3.12 / elements 요구 ^7.3.13 불일치가 있다.
- 온라인 `expo install --check`는 기존 Expo 패키지 13개와 RN의 패치 업데이트를 권고하며 종료 코드 1을 반환했다. 예: Expo ~57.0.25, RN 0.86.3. Firebase 설치와 함께 전체 Expo 업그레이드를 수행하지 않았다.
- 2026-09-28 SDK 설치 시점에는 Firebase 프로젝트 설정 파일·Provider 설정이 없어 네이티브 빌드와 실제 인증을 검증하지 않았다. 이후 연결 결과는 아래에 기록한다. 패키지 설치 완료를 실제 인증 연동 완료로 취급하지 않는다.


## 로컬 파일과 개발 인증 검증 화면 (2026-09-29)

- `config/firebase/GoogleService-Info.plist`, `config/firebase/google-services.json`: 사용자 제공 파일. 두 파일의 프로젝트 일치와 `com.toteacher.app` 식별자를 확인했다. Git·EAS 업로드에서 제외한다.
- EAS에서는 `GOOGLE_SERVICES_IOS`, `GOOGLE_SERVICES_ANDROID`를 **file 환경변수**로 등록한다. 파일이 개발용 프로젝트이므로 production 환경에는 해당 환경의 파일을 별도 등록한다.
- 로컬 Google Web/iOS Client ID는 제공 파일에서 추출해 추적하지 않는 `.env.local`에 반영했다. 실제 값은 문서·콘솔에 출력하지 않는다.
- 사용자 확인에 따라 테스트 Identity 서버는 `https://identity-test.to-teacher.com`을 사용한다. `.env.local`과 `.env.local.example`의 `EXPO_PUBLIC_IDENTITY_API_BASE_URL`에 반영했다. 이 주소는 후속 Identity API 연동에 사용하며 Firebase 인증만 수행하는 검증 화면에서는 호출하지 않는다.
- Google·Apple은 콘솔에서 활성화가 확인돼 검증 대상으로 둔다. 카카오는 `EXPO_PUBLIC_KAKAO_OIDC_PROVIDER_ID`가 없어 비활성화한다. Apple Android Services ID·redirect 완료 여부는 미확인이다.
- `expo-build-properties` 57.0.22(57.0.x 호환 범위)를 설치했다. Firebase 플러그인이 iOS Encoded App ID·Google 복귀 scheme을 등록하는 것을 확인했다.
- 생성된 Android debug 서명 SHA-1은 제공된 Google 설정 파일의 등록 지문과 일치한다.
- iOS simulator Debug 빌드와 Android `assembleDebug`가 성공했다. 두 플랫폼에 설치해 Firebase 초기화와 검증 화면 표시를 확인했다. Android Google 버튼은 Google 로그인 안내 화면을 열었다. iOS에는 개발 링크 열기 시스템 확인창이 남아 있다.
- 실제 계정 인증·ID Token 획득, Apple 인증, Identity 테스트 서버 응답은 아직 검증하지 않았다. 계정 인증은 사용자 조작이 필요하다.

검증 화면 실행:

```sh
EXPO_PUBLIC_FIREBASE_AUTH_VALIDATION=true EXPO_PUBLIC_AUTH_UI_PREVIEW=false EXPO_PUBLIC_SENTRY_VALIDATION_MODE=false pnpm start --dev-client
```

`__DEV__`에서만 활성화되며 AuthProvider를 거치지 않는다. Google·Apple 버튼으로 Firebase 인증과 ID Token 획득만 확인한다. Token·UID는 화면·로그에 표시하거나 저장하지 않는다. 기존 Identity 세션, 교환·가입·병합 API는 사용하지 않는다. 실행 중 취소와 실제 작업 종료 대기를 확인할 수 있다. 검증 종료 후 플래그 없이 Metro를 재시작하면 기존 앱 경로로 돌아간다.

실제 계정 선택·동의·비밀번호 입력은 사용자가 수행해야 한다. Firebase 로그인 성공을 서비스 로그인 완료로 취급하지 않는다.
