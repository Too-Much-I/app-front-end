# 로그인·회원가입 UI 미리보기

## 실행

```sh
NODE_OPTIONS=--dns-result-order=ipv4first EXPO_PUBLIC_AUTH_UI_PREVIEW=true pnpm start --dev-client --ios --localhost --clear
```

개발 빌드에서만 동작한다. `ipv4first`는 로컬 Metro가 IPv6에만 바인딩되어
시뮬레이터의 `127.0.0.1` 번들 요청이 실패하는 것을 방지한다. 실행 중인 Metro가 있다면 종료한 뒤 위 명령으로 다시 시작한다.
플래그를 빼거나 false로 바꾸고 재시작하면 기존 앱으로 돌아간다.
`.env.local.example`에도 설정을 기록했다. 릴리스 빌드에서는 플래그가 true여도 미리보기가 열리지 않는다.

미리보기는 별도 navigation root를 사용하고 AuthProvider를 마운트하지 않는다.
기존 Guest 세션, installationId, 약관 기록을 읽거나 변경하지 않는다.
미리보기에서는 analytics·Clarity·Sentry 초기화를 생략한다.

## 적용한 시안

| 화면 | 참조 |
| --- | --- |
| SNS 로그인 | `output/imagegen/auth/login-first-screen-v5.png` |
| 닉네임·필수 약관 | `output/imagegen/auth/signup-profile-v2.png` |
| 휴대전화 번호 입력 | `output/imagegen/auth/phone-number-final.png` |
| 인증번호 입력 | `output/imagegen/auth/phone-code-final.png` |
| 인증 오류·완료 | `phone-code-error-v2.png`, `phone-complete-v2.png` |

- 로그인 캐릭터는 기존 `public/mascots/greeting_rabbit_bust.png`를 사용.
- `curious-rabbit-v3.png`를 `public/auth/curious-rabbit.png`로 복사. 무시되는 output 폴더를 런타임에서 참조하지 않음.
- Google 컬러 마크는 승인된 로그인 v5의 아이콘을 추출한 `public/auth/google-logo.png` 사용.
- 색·간격·글꼴·모서리는 theme 토큰, 텍스트와 버튼은 공용 Text/Button 사용.
- SNS의 원형 아이콘 버튼은 공용 Pressable 사용. 공급자 고유 색은 외부 브랜드 색으로 별도 유지.
- 상단/하단은 실제 safe area 사용. 작은 화면과 키보드에서는 콘텐츠가 스크롤됨.

## 확인 순서

1. 카카오·Google·Apple 중 하나를 누르면 프로필 시안으로 이동한다. 실제 Provider 로그인은 수행하지 않는다.
2. 닉네임은 공백 제거 후 2~20자, 두 필수 약관을 모두 선택하면 다음 버튼이 활성화된다. 제출 시 목 닉네임 `토스마스터`와 비교하며 다른 값이면 오류를 표시하고 이동하지 않는다.
3. 약관의 상세 버튼은 미연동 안내를 표시한다. 실제 전문·정책 버전·동의 저장은 연결하지 않았다.
4. `01012345678`만 인증번호 화면으로 이동한다. 다른 010 형식의 11자리 번호는 오류를 표시한다. 형식이 맞지 않으면 버튼이 비활성화된다. 문자 발송은 없다.
5. 인증번호 `123456`만 완료 시안으로 이동한다. 다른 6자리 숫자는 인라인 오류를 표시한다. 목데이터 비교이며 실제 SMS 인증 결과가 아니다.
6. 번호·인증번호 화면의 ‘목데이터 채우기’는 정답을 입력란에 채울 뿐 단계를 건너뛰지 않는다. 기존 완료 우회 버튼은 제거했다. 닉네임·전화번호는 목데이터를 기본 입력해 빠르게 진행할 수 있다.
7. 수정은 번호 입력으로, 다시 받기는 코드 입력 초기화로 연결한다. 실제 재발송은 없다.
8. 닫기·둘러보기는 미연동 안내만 표시한다. Guest 계정을 새로 만들지 않는다.

## 의도적으로 남겨둔 연결 지점

화면의 콜백을 실제 Firebase/Identity 컨트롤러에 연결하는 것은 별도 작업이다.
전화번호 화면은 `PhoneVerificationViewState`로 번호/코드/완료를 구분하고, 외부에서 상태를 전달한다.
입력값은 메모리에만 있고 navigation params·로그·서버·저장소에 넣지 않는다.

- Firebase SNS 로그인, 환경별 Provider 노출
- exchange/prepare의 계정 분기와 enrollment 수명
- 같은 Firebase 사용자에 phone link, recent-auth, OTP 타임아웃·재발송 제한
- signup/upgrade 및 회원 토큰 저장
- 약관 전문·버전 공급과 서버 동의 저장
- 무료 모의고사 혜택 지급 여부, 비로그인 둘러보기 정책

## 시안과의 차이

- 닉네임 안내는 v2의 1~12자 대신 전달된 최신 API 명세의 2~20자로 수정했다.
- labelled 버튼은 `rounded-control`, 간격은 현재 토큰을 적용해 오래된 HTML 시안의 rem 수치를 그대로 복제하지 않았다.
- 실제 인증과 혼동되지 않도록 미리보기 배너와 상태 확인 도구를 둔다. 제품 화면 컴포넌트와 개발용 전환 코드는 분리했다.
- 입력해야 할 뼈대·인증 판단은 요청에 따라 뒤로 미뤘고, 제품 인증 로직을 임의 구현하지 않았다.

## 검증

- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm check:architecture`, `pnpm check:naming` 실행.
- Expo iOS 개발 번들 export로 NativeWind 처리, 모듈과 정적 이미지 포함을 확인.
- 목데이터의 닉네임·번호·인증번호 성공/실패 및 단계 우회 방지를 Node assert로 확인.
- iPhone 17 Pro 시뮬레이터에서 로그인 화면 정상 렌더링을 캡처로 확인.
- 나머지 화면의 수동 터치·키보드 검증은 사용자 확인 대상. 목 분기는 Node assert 검증 완료.
