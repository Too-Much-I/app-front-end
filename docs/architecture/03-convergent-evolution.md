# 진화수렴 · 디팩토와의 비교

조사 시점: 2026-08-31 (`feat/ten-second-challenge`, e80699d)

세 단계로 본다.

1. 지금 쓰는 기술과 컨셉을 **MECE하게** 분류
2. 각 컨셉에서 업계가 **어디로 수렴하고 있는가**
3. 우리 코드는 그 지점에서 **얼마나 떨어져 있고, 그 차이의 이유는 무엇인가**

> 트렌드 서술은 2026년 5월 기준 지식이다. 버전이 걸린 항목(◇ 표시)은 멘토링 자리에서
> 최신 상태를 확인하는 편이 낫다.

---

## 0. 한 장 요약

| # | 컨셉 | 수렴 지점 | 우리 위치 | 거리 |
|---|---|---|---|---|
| 1 | 런타임·빌드 | Expo + New Architecture | Expo 57 / RN 0.86 / New Arch | ● 도달 |
| 2 | 언어·타입 | TS strict + 판별 유니온 | 동일, `any` 0건 | ● 도달 |
| 3 | 런타임 검증 | 스키마 라이브러리 (zod 계열) | 수제 타입가드 | ◐ 의도적 이탈 |
| 4 | 라우팅 | 파일 기반 (Expo Router) | React Navigation 직접 | ◐ 의도적 이탈 |
| 5 | 스타일 | Tailwind 계열 + 토큰 단일 소스 | NativeWind 4 + tokens.js | ● 도달 (+ rem 스케일은 앞서감) |
| 6 | **서버 상태** | **TanStack Query** | **수제 훅 36개, 의존성만 설치** | **○ 가장 먼 지점** |
| 7 | 클라이언트 상태 | 경량 스토어 (zustand 등) | zustand 1곳 + 싱글턴 + Context | ◐ 부분 |
| 8 | 인증 | 보안 저장소 + 재발급 직렬화 | SecureStore + generation 기반 | ● 도달 |
| 9 | 미디어 업로드 | presigned direct upload | 동일 + 멱등 키 | ● 도달 |
| 10 | 하이브리드(WebView) | 네이티브로 회귀, 브리지는 계약화 | WebView 유지, 브리지 계약화 | ◐ 상황 의존 |
| 11 | 관측 | Sentry + 제품 분석 + 스크러빙 정책 | 3종 + 타입 카탈로그 + 허용 목록 | ◉ **앞서감** |
| 12 | 배포 | EAS Build/Submit + 환경 분리 | 동일 | ● 도달 |
| 13 | 품질 게이트 | lint + type + unit + E2E | lint + type만 | ○ 먼 지점 |
| 14 | 웹·앱 코드 공유 | 모노레포 | 별도 저장소 + WebView | ◐ 의도적 이탈 |
| 15 | 문서·에이전트 협업 | AGENTS.md + ADR | 둘 다 있음, 밀도 높음 | ◉ **앞서감** |

● 도달 ◐ 부분/의도적 이탈 ○ 먼 지점 ◉ 앞서감

---

## 1. 런타임 · 빌드

**수렴 방향** — React Native 생태계는 "Expo를 기본 경로로" 정리됐다. RN 공식 문서가 신규 앱에 Expo를
권한다. New Architecture(Fabric · TurboModules)가 기본값이 되면서 bridge 시대의 관용구가 사라지고 있다.
Metro가 사실상 유일한 번들러다.

**우리 위치** — Expo 57 / RN 0.86 / React 19.2. 네이티브 폴더(`ios/`, `android/`)를 갖는 prebuild 형태에
`expo-dev-client`를 쓴다. 순수 managed도 bare도 아닌, 지금 가장 흔한 형태다.

**차이** — 없다. `docs/why-expo-react-native.md`에 선택 근거가 남아 있다.

**눈에 띈 것** — `pnpm-workspace.yaml`을 워크스페이스가 아니라 **의존성 통제**에만 쓴다
(`@sentry/cli` postinstall 허용, async-storage 버전 고정으로 네이티브 모듈 이중 autolinking 방지).
Expo + pnpm 조합에서 실제로 물리는 지점이고, 주석에 이유가 적혀 있다. 이건 잘 알려진 함정을
정확히 짚은 것이다.

---

## 2. 언어 · 타입

**수렴 방향** — strict TS가 기본. 불리언 플래그 조합 대신 **판별 유니온으로 상태를 모델링**하는
방식이 널리 정착했다. `satisfies`로 리터럴 추론과 제약을 동시에 얻는 패턴도 표준이 됐다.

**우리 위치** — `strict` + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`.
`any` · `@ts-ignore` · `eslint-disable` 저장소 전체 **0건**. `satisfies`도 쓴다(`AUTH_ACTIONS`, `shadows`).
`switch`에 `never` exhaustiveness 체크도 있다.

**차이** — 없다. 이 축은 업계 상위 수준이다.

---

## 3. 런타임 검증 ◇

**수렴 방향** — 서버 응답을 신뢰하지 않는 것은 합의됐고, **방법**이 스키마 라이브러리(zod가 사실상
표준, valibot·ArkType이 번들 크기·성능으로 경쟁)로 수렴했다. 스키마 하나에서 타입과 검증기를 동시에
얻어 둘이 어긋날 수 없게 만드는 것이 핵심 이득이다.

**우리 위치** — 라이브러리 없이 손으로 짠 타입가드다.

```ts
function isRecord(v: unknown): v is Record<string, unknown>
function isNonEmptyString(v: unknown): v is string
function isPositiveInteger(v: unknown): v is number
```

이 세 개가 `auth/types.ts` · `native-data-bridge.ts` · `transport.ts` · `reanswer-message.ts` 등
**여러 파일에 각각 복사돼 있다.**

**차이의 이유** — 타당한 근거가 둘 있다. 하나는 의존성 최소화(AGENTS.md 규칙). 다른 하나는 이 앱의
검증 지점이 대부분 **매퍼**여서, 검증만이 아니라 "서버가 snake와 camel을 둘 다 준다", "빈 문자열을
null로 좁힌다" 같은 **정규화**를 함께 한다는 것 — zod로 표현하면 `.transform()` 체인이 되어 오히려
읽기 어려워질 수 있다.

**한계** — 타입 선언과 타입가드가 **따로** 있어서 필드를 추가할 때 둘 다 고쳐야 하고, 안 고쳐도
컴파일은 통과한다. `types/exam.ts`가 556줄이 된 지금 이 위험은 실재한다.

**판단** — 지금 바꿀 이유는 약하다. 다만 `isRecord`/`isNonEmptyString`/`isPositiveInteger` 중복만은
`lib/guards.ts`로 모으는 게 좋다. 스키마 도입 여부와 무관하게 이득이다.

---

## 4. 라우팅 ◇

**수렴 방향** — Expo Router의 파일 기반 라우팅으로 수렴 중이다. React Navigation은 그 아래 엔진으로
남았다. 파일 기반의 실질 이득은 딥링크 · 유니버설 링크 · 타입 안전 라우트가 **공짜로** 따라오는 것이다.

**우리 위치** — React Navigation 7을 직접 쓴다. 라우트 파라미터 타입을 `navigation/types.ts`에
손으로 관리하고, 그 대신 각 라우트에 **왜 그 파라미터가 필요한지** 주석을 달았다. 예:

> `nextRetryCount`는 0-base 회차 인덱스이며 앱이 다시 계산하지 않는다.
> 날짜는 앱이 계산한 값이 아니라 서버가 준 값이어야 한다 — 이후 요청의 `X-Challenge-Date`가 되어…

파일 기반에서는 이런 설명을 둘 자리가 마땅치 않다. 그리고 이 앱에는 **인증 상태가 스택 자체를 고르는**
구조가 있는데(`RootNavigator`가 세 갈래로 다른 `Stack.Navigator`를 반환), 파일 기반에서는 이걸
`_layout` + redirect로 표현해야 해서 오히려 흐름이 흩어진다.

**차이의 이유** — 딥링크 요구가 아직 없다. 웹 공유 진입도 없다(웹은 별도 서비스).

**판단** — 지금은 맞는 선택이다. **딥링크나 푸시 알림 딥링크가 요구사항이 되는 순간** 다시 봐야 한다.
알림 화면이 이미 있으므로(목 데이터) 그 순간이 멀지 않을 수 있다.

---

## 5. 스타일 시스템

**수렴 방향** — Tailwind 계열 유틸리티가 RN에서도 자리를 잡았다(NativeWind, Unistyles가 경쟁).
디자인 토큰을 **한 파일에서** 정의하고 Tailwind config와 런타임 양쪽이 그걸 읽게 하는 구조가 표준이다.

**우리 위치** — 정확히 그 구조다. `theme/tokens.js`(CommonJS) → `tailwind.config.js`(require) +
`theme/index.ts`(타입 붙여 재수출). CommonJS인 이유가 파일 상단에 적혀 있다.

**앞서가는 것 — rem 런타임 스케일링.** `metro.config.js`에서 `inlineRem: false`로 두어 rem을 빌드 타임
상수로 굽지 않고 런타임 옵저버블로 남긴 뒤, 화면 폭에서 계산한 배율을 `rem.set()`으로 넣는다.
그 결과 **모든 `text-*` 유틸리티가 기기 폭에 따라 함께 커진다.** 게다가 같은 배율을 웹뷰 URL의
`?scale=`로 넘겨 앱과 웹의 글자 크기를 맞춘다.

이건 업계 관용구가 아니다. 보통은 각 컴포넌트에서 `moderateScale()` 같은 함수를 호출하거나 포기한다.
`scaleForWidth`가 폭 비율을 그대로 쓰지 않고 절반(SLOPE 0.5)만 반영하고 상·하한을 두는 것, 기기별
실측 표를 주석에 남긴 것, Part 4 가로 표에서는 **짧은 변**을 써서 정보 밀도를 지키는 것까지 —
문제를 끝까지 밀어붙인 흔적이다.

**차이** — 없음. 오히려 소개할 만한 사례다.

---

## 6. 서버 상태 ← 가장 먼 지점

**수렴 방향** — 이 영역은 논쟁이 끝났다. **TanStack Query**가 사실상 표준이고, "서버 상태는 클라이언트
상태가 아니다"라는 구분이 전제로 깔린다. 캐시 · 무효화 · 중복 제거 · 리트라이 · 폴링 · 낙관적 갱신을
직접 구현하지 않는다.

**우리 위치** — `@tanstack/react-query`가 의존성에 있지만 **사용처 0**, `QueryClientProvider`도 없다.
36개 훅이 `useState` + `useEffect` + `AbortController`로 각자 구현한다.

같은 문제를 세 번 다르게 푼 흔적:

| | `use-grading-status` | `use-challenge-result` | `summary-feedback-retry-polling` |
|---|---|---|---|
| 주기 | 자체 | 고정 배열 `[2, 2.5, …, 5]s` | 자체 |
| 예산 | 자체 | 180초 | 자체 |
| 성공 판정 | 자체 | `hasLoadedOnce` | 자체 |
| 취소 | AbortController | AbortController + timerRef | AbortController |

캐시가 없어서 화면을 오갈 때마다 같은 조회가 다시 나간다. 이미
`docs/decisions/2026-08-25-챌린지-진행내역-캐시-만료.md`에서 캐시 만료를 손으로 다루고 있다 —
즉 **직접 캐시를 만들기 시작한 상태**다.

**차이의 이유** — 추정하자면 두 가지다. (a) 웹에서 부분 이식하며 화면 단위로 옮기다 보니 계층을
세울 순간이 없었다. (b) 각 훅이 "조회"가 아니라 "생명주기"에 가깝다 — `useChallengeAttempt`는
조회가 아니라 자원 발급이고, `useAnswerSubmissions`는 업로드 큐다. 이런 것들은 Query로 옮겨도
`useMutation`을 감싼 커스텀 훅이 되므로 이득이 작다.

**하지만** 순수 조회·폴링인 것들은 분명하다: `useChallengeQuestion`, `useChallengeResult`,
`useChallengeToday`(스테이지가 생기면), `useRecentFeedback`, `useReanswerQuestion`, `useGradingStatus`,
`useExamHistory`. 일곱 개다.

**판단** — 셋 중 하나를 골라야 한다.
1. 도입한다 — 조회·폴링 7개만 옮기고 생명주기 훅은 그대로 둔다
2. 지운다 — 의존성을 제거하고 "손으로 짠다"를 명시적 결정으로 만든다. 대신 폴링 유틸을 하나로 모은다
3. 그대로 둔다 — 다음 화면마다 폴링이 하나씩 늘어난다

**가장 나쁜 것이 3번이다.** 지금은 "쓰기로 했는데 안 쓰는" 상태라 읽는 사람이 잘못된 기대를 한다.

---

## 7. 클라이언트 상태

**수렴 방향** — Redux는 신규 프로젝트에서 물러났다. zustand · jotai 같은 경량 스토어 + Context는
"진짜 전역인 소수"만, 나머지는 지역 상태. 그리고 `useSyncExternalStore`가 외부 스토어를 React에
붙이는 표준 경로가 됐다.

**우리 위치** — 세 방식이 공존한다.

| 방식 | 어디 | 왜 |
|---|---|---|
| 모듈 싱글턴 + `useSyncExternalStore` | `authController` | React 밖(`lib/api/client`)에서도 토큰을 읽어야 한다 |
| zustand vanilla + `useStore` | `exam-session-store` | 판단은 `get()`으로 즉시 읽고 화면은 구독으로 따라온다 |
| Context | `AuthContext`, `OrientationContext` | 공급자 경계가 명확한 것 |

**이건 잘한 선택이다.** 특히 `authController`를 싱글턴으로 둔 것 — API 클라이언트가 React 트리 밖에
있으므로 Context로는 토큰을 줄 수 없다. `useSyncExternalStore`로 React에 붙이면서 React 밖 접근도
유지하는 건 정확한 해법이다.

**차이** — zustand가 저장소에서 **한 곳에서만** 쓰인다. 그것도 `screens/` 아래에서. "우리는 zustand를
쓴다"인지 "저 화면만 zustand다"인지가 코드에서 읽히지 않는다. 챌린지 스테이지처럼 다음 상태 기계가
필요할 때 무엇을 쓸지 정해져 있지 않다.

---

## 8. 인증

**수렴 방향** — 토큰은 SecureStore(Keychain/Keystore)에, 리프레시는 **동시 요청을 하나로 직렬화**하고,
401은 한 번만 복구하고, 재발급 실패는 로그아웃으로 떨어뜨린다. 여기까지가 공통 관용구다.

**우리 위치** — 전부 있다. 그 위에 두 가지가 더 있다.

- **`generation` 기반 복구** — `prepareRequest()`가 토큰과 함께 세대 번호를 준다. 401을 받은 요청은
  자기가 받았던 세대를 들고 `recoverUnauthorized(generation)`을 부른다. 이미 다른 요청이 재발급을
  끝냈다면 새 토큰만 받고, 아니면 자기가 재발급을 시작한다. **재발급이 요청 수만큼 일어나지 않는다.**
- **`isDefinitiveRefreshFailure`** — 회복 불가능한 재발급 실패와 일시적 실패를 구분해, 전자만 게스트
  재생성으로 간다.

- **부트스트랩을 상태 기계로** — 8개 상태 × `BootstrapRetry` 8종. 실패 지점마다 **그 작업 하나만**
  다시 실행한다(`{ operation: "persist-consent", consent, continuation }`). 보통은 "처음부터 다시"로
  뭉개는 자리다.

**차이** — 없음. 이 영역도 소개할 만한 사례다.

---

## 9. 미디어 업로드

**수렴 방향** — presigned URL로 **클라이언트가 스토리지에 직접** 올리고, 서버에는 완료만 통지한다.
서버를 통과시키지 않는 것이 표준이다.

**우리 위치** — 동일. 그 위에 재시도가 응시 횟수를 소비하지 않게 하는 장치가 둘 있다.

- 업로드 URL을 재발급해도 **attempt에 고정된 같은 S3 key**로만 나온다
- 접수 통지는 **같은 `Idempotency-Key`를 성공할 때까지 붙들고** 다시 보낸다
- 만료(403)만 골라내 URL만 재발급하고 파일은 다시 올리지 않는다
- 업로드 예산 = `min(URL 만료, 제출 유효시각)` — 둘 다 서버가 주는 값

**차이** — 없음. 오히려 촘촘하다.

---

## 10. 하이브리드 (WebView)

**수렴 방향** — 여기는 **되돌아온** 영역이다. 2010년대에 하이브리드로 갔다가 성능·제스처·접근성
문제로 네이티브로 회귀했다. 지금 WebView가 남는 자리는 (a) 약관·정책처럼 자주 바뀌고 상호작용이
적은 콘텐츠, (b) 웹에 이미 있고 앱에서 급히 필요한 화면 — 즉 **과도기 수단**이다.
그래서 요즘 논의는 "WebView를 쓸까"가 아니라 "쓴다면 브리지를 어떻게 안전하게 계약화할까"다.

**우리 위치** — 피드백(종합·문제별)이 웹이다. 이건 앱의 핵심 가치 화면이라 (a)에도 (b)에도 딱
들어맞진 않는다. 다만 **브리지 설계는 모범적이다.**

- 액세스 토큰을 웹에 넘기지 않는다. 웹은 `resource` 이름만 말하고 앱이 대신 조회한다
- **임의 경로 프록시를 제공하지 않는다** — 알려진 resource 이름과 검증된 파라미터로만 경로를 조립
- `currentExamId`와 다른 시험의 요청은 거른다
- `window.__nativeCapabilities`로 버전 협상 — 구버전 앱에서 웹이 기능을 끌 수 있다
- 이름을 바꿀 때 **전환용 별칭**을 남겨 배포 순서 불일치를 흡수한다
- `FEEDBACK_DATA_READY`가 10초 안에 안 오면 스켈레톤을 강제로 걷는 안전장치

**차이의 이유** — 앱이 웹보다 나중에 생겼고 피드백 화면이 이미 웹에 있었다
(`docs/why-new-repo-and-partial-copy.md`).

**판단** — 브리지 코드가 이미 `features/exam/` 안에 6개 모듈(`native-data-bridge`, `reanswer-message`,
`go-home-message`, `feedback-data-ready-message`, `feedback-history-message`, `summary-feedback-retry-*`)
로 자란 상태다. **"웹뷰를 유지하는 비용"이 계약 유지 비용으로 나타나기 시작했다.** 피드백 화면을
네이티브로 옮길지, 아니면 브리지를 하나의 명시적 프로토콜 모듈로 묶을지 결정할 시점에 가깝다.

---

## 11. 관측 ← 앞서가는 지점

**수렴 방향** — Sentry가 RN 크래시/오류의 사실상 표준. 제품 분석은 Amplitude/Mixpanel/PostHog.
개인정보 스크러빙은 "해야 한다"는 합의는 있지만 **구현은 대개 SDK 기본 설정에 맡긴다.**
이벤트 이름을 타입으로 강제하는 것도 좋은 팀만 한다.

**우리 위치 — 두 가지가 업계 평균을 넘는다.**

1. **운영 오류를 코드 + 허용 목록으로 모델링했다.** `OperationalErrorInput`이 16개 코드에 대해
   각각 어떤 필드를 가질 수 있는지 판별 유니온으로 정의하고, `toSafeContext`가 string·number·boolean만
   통과시킨다. raw Error는 `ApiError`의 status·code만 뽑고 **message·stack·URL·응답 본문을 버린다.**
   "사용자 흐름을 실제로 막은 handled failure만" 보낸다는 원칙이 코드로 강제된다.

2. **그 정책을 검증하는 장치가 있다.** `previewOperationalError`(보내지 않고 payload만 반환) +
   `features/diagnostics/sentry-validation-catalog` + 별도 앱 루트(`SentryValidationScreen`).
   스크러빙이 실제로 도는지 개발 빌드에서 확인할 수 있다.

3. **Amplitude와 Sentry가 같은 기준을 쓴다.** `analytics-events.ts` 주석에 명시돼 있다 —
   "Sentry가 redact하는 값을 분석 도구에만 평문으로 보내면 정책이 어긋난다." 자동 수집도
   `elementInteractions: false`(눌린 요소 텍스트에 답안이 샐 수 있음), `networkTracking: false`
   (URL에 examId가 실림)로 이유와 함께 꺼져 있다.

**차이 — 한 곳만 비어 있다.** `OPERATIONAL_ERROR_CODES` 16개 중 **challenge 관련이 0개**다.
새 기능이 관측 체계에 아직 안 들어왔다. 출시 후 챌린지가 깨지면 알 방법이 없다.

---

## 12. 배포

**수렴 방향** — Expo 앱은 EAS Build/Submit + 환경별 EAS Environment. 버전 출처 단일화.
소스맵 업로드 자동화.

**우리 위치** — 전부 있다. `app.config.ts`가 버전만 `package.json`에서 읽어 오는 이유가 주석에 있고,
"릴리스 태그와 대조하는 검사는 아직 없다"는 미완성 사실까지 적어 뒀다. `EXPO_PUBLIC_*`(공개)와
`SENTRY_AUTH_TOKEN`(비공개)의 구분 이유도 `.env.local.example`에 적혀 있다.

**차이** — 없음. 다만 EAS Update(OTA)를 쓰지 않는다. 규모상 아직 필요 없다.

---

## 13. 품질 게이트 ← 두 번째로 먼 지점

**수렴 방향** — RN 앱의 표준 조합은 대략 이렇다.

| 층 | 도구 |
|---|---|
| 정적 | TypeScript + ESLint(또는 Biome/oxlint) |
| 단위 | Jest + React Native Testing Library |
| E2E | Maestro (Detox에서 이동 중) |
| 릴리스 | EAS Build + 스토어 심사 전 preview 배포 |

**우리 위치** — 정적 층만 있다. CI(`lint + typecheck`)는 잘 짜여 있다 — concurrency 취소,
`persist-credentials: false`, lint가 실패해도 typecheck를 돌려 한 번에 두 결과를 보게 하는 것까지.
**하지만 그 위가 없다.**

**차이의 이유** — 출시 일정. 그리고 이 앱의 상당 부분이 실기기 오디오·권한이라 단위 테스트로
잡히지 않는 것도 사실이다.

**하지만** 순수 함수가 40개 이상이다(매퍼 7, `resolve*` 3, `scaleForWidth`, `decidePartPrelude`,
`findCorrectionSpans`, `normalizeCorrectionSeverity`, `parseNativeDataRequest`, `getEqualJitterDelayMs` …).
이들은 기기도 서버도 필요 없다. **`previewOperationalError`는 테스트를 위해 만든 함수인데
테스트가 없다** — 검증 장치를 만들어 두고 자동화만 안 한 상태다.

**판단** — 이게 앞의 모든 개선의 전제다. 리팩터링 안전망 없이는 6·7·10 중 어느 것도 손대기 어렵다.
Jest 배선 반나절 + 매퍼부터 점진 적용이면 충분하다.

---

## 14. 웹 · 앱 코드 공유

**수렴 방향** — 웹과 앱을 함께 만드는 팀은 모노레포(pnpm workspace + Turborepo)로 타입·API 클라이언트·
도메인 로직을 공유한다. RN Web으로 컴포넌트까지 공유하는 경우도 있지만 그건 소수다.

**우리 위치** — 별도 저장소(`soma/web-front-end`, `soma/app-front-end`) + WebView.
`docs/why-new-repo-and-partial-copy.md`에 근거가 있다.

**실제 비용** — 이미 드러나 있다.
- 웹뷰 메시지 계약이 **두 저장소에 각각** 존재하고, 배포 순서가 어긋날 수 있어 버전 협상과
  전환용 별칭이 필요해졌다
- 첨삭 심각도 동의어 표(`major`→`high` 등)와 밑줄 구간 계산 규칙이 "웹 상세 피드백과 같은 규칙"이라는
  주석과 함께 **앱에도 다시 구현**돼 있다
- `formatRetryLabel`이 "웹의 회차 칩과 같은 규칙"이어야 한다는 제약이 주석으로만 유지된다

**판단** — 저장소를 합치는 건 큰 결정이라 지금 권할 일은 아니다. 다만 **웹뷰 메시지 계약만이라도**
공유 패키지(또는 최소한 계약 문서 하나)로 뽑으면 배포 순서 사고를 줄일 수 있다.

---

## 15. 문서 · 에이전트 협업 ← 앞서가는 지점

**수렴 방향** — `AGENTS.md`가 AI 에이전트에게 저장소 규칙을 주는 관용구로 빠르게 자리 잡았다.
ADR(결정 기록)은 오래된 관행이지만 실제로 유지되는 곳은 드물다.

**우리 위치** — 둘 다 있고, 밀도가 높다.

- `AGENTS.md` 89줄이 실제 규칙만 담는다. 죽은 워크플로(`specs/`)를 "따르지 말라"고 명시적으로
  방어하는 것까지 포함해서
- `docs/decisions/` 11개. 형식이 고정돼 있고(문제/선택지/결정/코드 흐름 변화/뼈대→구현 차이/기준 충돌)
  **4개 섹션은 사람이 쓴다**는 규칙이 있다
- `docs/how-we-work.md`의 5단계 흐름 — 특히 **3단계에서 사람이 뼈대 코드를 쓴다**는 것.
  "자연어 슈도코드가 아니라 실제 코드 형태여야 stale closure 같은 실제 결함이 4단계에서 드러난다"는
  근거까지 있다
- "기준이 충돌하면 AI가 임의로 정하지 않고 사람에게 묻는다"

**이건 업계 평균보다 앞서 있다.** 대부분의 AGENTS.md는 "타입스크립트를 쓰세요" 수준이다.

**차이 — 문서의 노이즈.** `specs/` 14개 폴더와 `docs/superpowers/`가 죽은 산출물로 남아 있다.
문서 파일이 코드 파일보다 많고, AGENTS.md가 그중 하나를 "읽지 말라"고 방어해야 하는 상태다.
새 참여자(사람이든 에이전트든)에게 가장 큰 진입 비용이다. **지우는 게 낫다** — git 히스토리에 남는다.

---

## 16. 정리 — 세 문장

1. **기반은 이미 수렴 지점에 있다.** 런타임·타입·스타일·인증·업로드·배포는 손댈 곳이 없고,
   관측과 문서는 오히려 앞서 있다.
2. **비어 있는 칸은 두 개다** — 서버 상태 계층(§6)과 테스트 층(§13). 둘 다 "잘못 만든 것"이 아니라
   "아직 안 만든 것"이라 지금 채우는 비용이 가장 싸다.
3. **의도적으로 다르게 간 것들(§3 검증, §4 라우팅, §10 웹뷰, §14 별도 저장소)은 각각 근거가 있고
   문서화돼 있다.** 다만 근거의 유효기간이 다르다 — 라우팅은 딥링크가 생기는 순간, 웹뷰는 브리지
   모듈이 더 늘어나는 순간, 별도 저장소는 계약 불일치 사고가 한 번 나는 순간이 재검토 시점이다.
