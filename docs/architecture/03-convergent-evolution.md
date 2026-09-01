# 진화수렴 · 디팩토와의 비교

최초 조사 시점: 2026-08-31 (`feat/ten-second-challenge`, e80699d)

재검증 시점: 2026-08-31 (`refactor/dependency-architecture`, a4bc520)

세 단계로 본다.

1. 지금 쓰는 기술과 컨셉을 **MECE하게** 분류
2. 각 컨셉에서 업계가 **어디로 수렴하고 있는가**
3. 우리 코드는 그 지점에서 **얼마나 떨어져 있고, 그 차이의 이유는 무엇인가**

> 트렌드 서술은 2026년 5월 기준 지식이다. 버전이 걸린 항목(◇ 표시)은 멘토링 자리에서
> 최신 상태를 확인하는 편이 낫다.
>
> 아래의 "우리 위치"는 저장소 코드로 검증했다. 반면 "업계 상위", "가장 흔한 형태",
> "앞서감" 같은 상대 평가는 저장소만으로 입증할 수 없으므로 구현 사실과 분리해 읽는다.

---

## 0. 한 장 요약

| # | 컨셉 | 수렴 지점 | 우리 위치 | 거리 |
|---|---|---|---|---|
| 1 | 런타임·빌드 | Expo + New Architecture | Expo 57 / RN 0.86 / New Arch | ● 구성 도달 |
| 2 | 언어·타입 | TS strict + 판별 유니온 | 동일, `any` 0건 | ● 강함 |
| 3 | 런타임 검증 | 스키마 라이브러리 (zod 계열) | 수제 타입가드 | ◐ 의도적 이탈 |
| 4 | 라우팅 | 파일 기반 (Expo Router) | React Navigation 직접 | ◐ 의도적 이탈 |
| 5 | 스타일 | Tailwind 계열 + 토큰 단일 소스 | NativeWind 4 + tokens.js + rem 런타임 스케일 | ● 강함 |
| 6 | **서버 상태** | **TanStack Query** | **이력 화면만 Query, 나머지 조회·폴링은 직접 구현** | **◐ 도입 시작** |
| 7 | 클라이언트 상태 | 경량 스토어 + Context | 접근 범위·수명별로 싱글턴/zustand/Context 선택 | ● 경계별 적합 |
| 8 | 인증 | 보안 저장소 + 재발급 직렬화 | SecureStore + generation 기반 | ● 설계 도달 |
| 9 | 미디어 업로드 | presigned direct upload | 동일 + 멱등 키 | ● 도달 |
| 10 | 하이브리드(WebView) | 네이티브로 회귀, 브리지는 계약화 | WebView 유지, 브리지 계약화 | ◐ 상황 의존 |
| 11 | 관측 | Sentry + 제품 분석 + 스크러빙 정책 | 3종 + 타입 카탈로그 + 허용 목록, challenge 공백 | ● 강함 |
| 12 | 배포 | EAS Build/Submit + 환경 분리 | 저장소 설정 완료, 실제 릴리스는 별도 검증 | ● 구성 도달 |
| 13 | 품질 게이트 | lint + type + unit + E2E | lint + type + naming, 자동 테스트 없음 | ○ 먼 지점 |
| 14 | 웹·앱 코드 공유 | 모노레포 | 별도 저장소 + WebView | ◐ 의도적 이탈 |
| 15 | 문서·에이전트 협업 | AGENTS.md + ADR | 둘 다 있음, 밀도 높음 | ● 강함 + 탐색 노이즈 |

● 구성·설계가 강함 ◐ 부분/의도적 이탈 ○ 큰 공백

---

## 1. 런타임 · 빌드

**수렴 방향** — React Native 생태계는 "Expo를 기본 경로로" 정리됐다. RN 공식 문서가 신규 앱에 Expo를
권한다. New Architecture(Fabric · TurboModules)가 기본값이 되면서 bridge 시대의 관용구가 사라지고 있다.
Metro가 사실상 유일한 번들러다.

**우리 위치** — Expo 57 / RN 0.86 / React 19.2. 네이티브 폴더(`ios/`, `android/`)를 갖는 prebuild 형태에
`expo-dev-client`를 쓴다. 순수 managed도 bare도 아닌 prebuild 기반 구성이다. Android는
`newArchEnabled=true`가 명시돼 있다.

**차이** — 저장소에서 확인되는 구성 차이는 없다. 다만 이것이 "지금 가장 흔한 형태"인지까지는
코드로 검증할 수 없다. `docs/why-expo-react-native.md`에 이 저장소가 이 구성을 택한 근거는 남아 있다.

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

**차이** — 정적 타입 규율은 강하다. 다만 "업계 상위"는 외부 비교가 필요한 표현이고, 자동 테스트가
없으므로 타입으로 잡히지 않는 런타임 동작까지 안전하다는 뜻은 아니다. Dependency-Cruiser로 타입
의존성까지 검사하고 순환을 0개로 만든 점은 이 축의 실제 근거다.

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
컴파일은 통과한다. `types/exam.ts`가 575줄이 된 지금 이 위험은 실재한다.

**판단** — 지금 스키마 라이브러리로 전환할 이유는 약하다. 공용 가드는 **이름이 아니라 의미가 같을
때만** 모은다. 실제로 `isRecord`는 어떤 경계에서는 배열을 제외하고 다른 곳에서는 허용하며,
`isNonEmptyString`도 공백을 trim하는 버전과 길이만 보는 버전이 있다. 이 차이를 지운 채
`lib/guards.ts` 하나로 합치면 중복은 줄지만 경계 정책이 결합된다. 완전히 같은 구현만 공유하고,
서버 응답·저장소·웹뷰 메시지처럼 의미가 다른 검증은 해당 경계 가까이에 두는 편이 낫다.

---

## 4. 라우팅 ◇

**수렴 방향** — Expo Router의 파일 기반 라우팅 채택이 늘었고 React Navigation은 그 아래 엔진으로
남았다. 파일 구조와 URL 구조가 가까워지는 이점은 있지만, 딥링크 허용 범위·인증 게이트·외부 진입
파라미터 검증까지 공짜가 되는 것은 아니다.

**우리 위치** — React Navigation 7을 직접 쓴다. 라우트 파라미터 타입을 `navigation/types.ts`에
손으로 관리하고, 그 대신 각 라우트에 **왜 그 파라미터가 필요한지** 주석을 달았다. 예:

> `nextRetryCount`는 0-base 회차 인덱스이며 앱이 다시 계산하지 않는다.
> 날짜는 앱이 계산한 값이 아니라 서버가 준 값이어야 한다 — 이후 요청의 `X-Challenge-Date`가 되어…

파일 기반에서도 주석이나 별도 route contract로 설명할 수 있지만, 현재처럼 한 타입 파일에서 전체
계약을 훑는 장점은 줄 수 있다. 그리고 이 앱에는 **인증 상태가 스택 자체를 고르는**
구조가 있는데(`RootNavigator`가 세 갈래로 다른 `Stack.Navigator`를 반환), 파일 기반에서는 이걸
`_layout` + redirect로 표현하게 된다. 흐름이 반드시 나빠진다기보다, 한 함수에 모인 현재 구조와
비교해 인증 판단 위치가 달라지는 트레이드오프다.

**차이의 이유** — 딥링크 요구가 아직 없다. 웹 공유 진입도 없다(웹은 별도 서비스).

**판단** — 딥링크 요구가 없는 지금은 합리적인 선택이다. **딥링크나 푸시 알림 외부 진입이 실제
요구사항이 되는 순간** 전환 비용과 직접 설정 비용을 다시 비교한다. 알림 목 화면이 있다는 사실만으로
그 시점이 임박했다고 단정하지는 않는다.

---

## 5. 스타일 시스템

**수렴 방향** — Tailwind 계열 유틸리티가 RN에서도 자리를 잡았다(NativeWind, Unistyles가 경쟁).
디자인 토큰을 **한 파일에서** 정의하고 Tailwind config와 런타임 양쪽이 그걸 읽게 하는 구조가 표준이다.

**우리 위치** — 정확히 그 구조다. `theme/tokens.js`(CommonJS) → `tailwind.config.js`(require) +
`theme/index.ts`(타입 붙여 재수출). CommonJS인 이유가 파일 상단에 적혀 있다.

**특징적인 것 — rem 런타임 스케일링.** `metro.config.js`에서 `inlineRem: false`로 두어 rem을 빌드 타임
상수로 굽지 않고 런타임 옵저버블로 남긴 뒤, 화면 폭에서 계산한 배율을 `rem.set()`으로 넣는다.
그 결과 **모든 `text-*` 유틸리티가 기기 폭에 따라 함께 커진다.** 게다가 같은 배율을 웹뷰 URL의
`?scale=`로 넘겨 앱과 웹의 글자 크기를 맞춘다.

이건 업계 관용구가 아니다. 보통은 각 컴포넌트에서 `moderateScale()` 같은 함수를 호출하거나 포기한다.
`scaleForWidth`가 폭 비율을 그대로 쓰지 않고 절반(SLOPE 0.5)만 반영하고 상·하한을 두는 것, 기기별
실측 표를 주석에 남긴 것, Part 4 가로 표에서는 **짧은 변**을 써서 정보 밀도를 지키는 것까지 —
문제를 끝까지 밀어붙인 흔적이다.

**차이** — 구현 근거가 가장 잘 남은 축이고 소개할 만한 사례다. 다만 자체 해법이 곧 우월함을 뜻하지는
않는다. 폴더블·Split View·접근성 글자 확대에서의 결과를 고정하는 시각 회귀 테스트는 아직 없다.

---

## 6. 서버 상태 ← 가장 먼 지점

**수렴 방향** — 이 영역은 논쟁이 끝났다. **TanStack Query**가 사실상 표준이고, "서버 상태는 클라이언트
상태가 아니다"라는 구분이 전제로 깔린다. 캐시 · 무효화 · 중복 제거 · 리트라이 · 폴링 · 낙관적 갱신을
직접 구현하지 않는다.

**우리 위치** — `@tanstack/react-query`를 2026-08-31(PR #41)에 처음 쓰기 시작했다. `QueryClientProvider`가
Sentry 검증 모드가 아닌 트리에 붙었고, `useQuery` 호출은 시험 이력 경로 두 곳뿐이다
(`ExamHistoryTabView`, `ReanswerHistoryPanel`). 나머지 조회·폴링은 그대로다.
현재 `use-*.ts(x)` 파일은 22개이고 내보낸 `use*` 함수 전체는 26개다. 이 전부가 서버 상태 훅은 아니지만,
남은 조회·폴링 훅들이 `useState` + `useEffect` + `AbortController`로 각자 생명주기를 구현하는 것은 사실이다.

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

**하지만** Query 후보가 되는 멱등 조회·폴링 경로는 분명하다: `useChallengeQuestion`,
`useChallengeResult`, `useRecentFeedback`, `useReanswerQuestion`, `useGradingStatus`, 그리고
`ExamHistoryTabView` 내부 조회다. `useChallengeToday`와 `useExamHistory`라는 훅은 현재 존재하지 않는다.
반대로 attempt 발급, 녹음, 업로드 큐는 Query 도입 뒤에도 별도 생명주기 상태 기계가 필요하다.

**판단** — 셋 중 하나를 골라야 한다.

1. 도입한다 — 위의 멱등 조회·폴링 후보만 옮기고 생명주기 훅은 그대로 둔다
2. 지운다 — 의존성을 제거하고 "손으로 짠다"를 명시적 결정으로 만든다. 대신 폴링 유틸을 하나로 모은다
3. 그대로 둔다 — 다음 화면마다 폴링이 하나씩 늘어난다

**가장 설명하기 어려운 것이 3번이다.** 지금은 "쓰기로 했는데 안 쓰는" 상태라 읽는 사람이 잘못된
기대를 한다. 이것이 저장소의 큰 공백인 것은 맞지만, 테스트 부재보다 객관적으로 더 먼 지점인지는
우선순위 판단의 영역이다.

> **결정 (2026-08-31, PR #41)** — 1번을 골랐다. 시험 이력 조회를 첫 사례로 옮겼고, 나머지 후보는
> 사례가 하나 더 쌓인 뒤 "어떤 조회를 Query로 옮기는가"의 기준을 `AGENTS.md`에 적고 진행한다.
> 위의 세 갈래와 그 근거는 결정 당시의 상태 기록으로 남긴다.

---

## 7. 클라이언트 상태

**수렴 방향** — Redux는 신규 프로젝트에서 물러났다. zustand · jotai 같은 경량 스토어 + Context는
"진짜 전역인 소수"만, 나머지는 지역 상태. 그리고 `useSyncExternalStore`가 외부 스토어를 React에
붙이는 표준 경로가 됐다.

**우리 위치** — 상태를 세 종류로 임의 분류한 것이 아니라, **누가 React 밖에서 읽어야 하는가**와
**상태의 수명이 어디까지인가**에 따라 세 연결 방식을 쓴다.

| 방식 | 어디 | 왜 |
|---|---|---|
| 모듈 싱글턴 + `useSyncExternalStore` | `authController` | React 밖(`lib/api/client`)에서도 토큰을 읽어야 한다 |
| 세션 범위 zustand vanilla + `useStore` | `exam-session-store` | 타이머·비동기 콜백은 `get()`으로 즉시 읽고 화면은 필요한 조각만 구독한다 |
| Context | `AuthContext`, `OrientationContext` | 공급자 경계가 명확한 것 |

**인증 싱글턴.** `authController`는 토큰 한 벌, SecureStore 동기화, 동시 refresh 직렬화를 앱 전체에서
하나만 소유해야 한다. API 클라이언트는 React 트리 밖의 일반 TypeScript 모듈이라 Context를 읽을 수
없으므로, 요청 직전에 `authController.prepareRequest()`를 직접 부른다. 화면은 같은 controller를
`useSyncExternalStore`로 구독한다. `AuthContext`는 별도 인증 상태를 하나 더 저장하는 곳이 아니라,
controller의 snapshot과 action을 React 컴포넌트에 편하게 배포하는 어댑터다.

**시험 세션 store.** 이름은 store지만 앱 전체 전역 싱글턴이 아니다. `useExamSessionController`가
마운트될 때 `useState(() => createExamSessionStore(session))`로 한 번 만들고, 시험 화면이 끝나면 함께
사라진다. 이전에는 진행 상태를 React state와 최신값 확인용 ref 두 벌로 들고 있어 서로 어긋날 수 있었다.
지금은 zustand 한 벌을 두고 타이머·오디오 완료 콜백·제출 완료 콜백은 `store.getState()`로 그 순간의
값을 읽으며, UI는 selector로 필요한 상태만 구독한다. 즉 선택 이유는 "전역 상태가 필요해서"가 아니라
**React 렌더와 명령형 비동기 콜백이 같은 최신 상태를 보게 하기 위해서**다.

**Context.** Orientation처럼 React 하위 트리 안에서만 필요하고 provider 수명이 곧 상태 수명인 값은
Context가 가장 단순하다. 인증에도 Context가 보이지만, 위에서 말했듯 실제 소유자는 싱글턴 controller다.

**차이** — zustand가 한 곳에서만 쓰인다는 사실 자체는 문제가 아니다. 필요한 상태 기계가 하나라면
한 곳만 쓰는 것이 자연스럽다. 실제 빈칸은 다음 상태 기계가 생겼을 때 **세션 범위 external store를
고르는 기준**이 문서화돼 있지 않다는 점과, 도메인 상태 기계인 `exam-session-store`가 `screens/` 아래에
있어 장기적으로 화면 구현인지 시험 도메인인지 소유권이 흐릴 수 있다는 점이다.

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

**차이** — 설계는 소개할 만하다. 다만 `auth-controller.ts`가 821줄이고 자동 테스트가 없다. 동시 401,
refresh 중 저장 실패, 로그아웃과 회전 경합 같은 경로를 코드 리뷰만으로 계속 보증하기는 어렵다.
따라서 "차이 없음"보다는 **설계는 강하고 회귀 안전망이 비어 있음**이 정확하다.

---

## 9. 미디어 업로드

**수렴 방향** — presigned URL로 **클라이언트가 스토리지에 직접** 올리고, 서버에는 완료만 통지한다.
서버를 통과시키지 않는 것이 표준이다.

**우리 위치** — 동일. 그 위에 재시도가 응시 횟수를 소비하지 않게 하는 장치가 둘 있다.

- 업로드 URL을 재발급해도 **attempt에 고정된 같은 S3 key**로만 나온다
- 접수 통지는 **같은 `Idempotency-Key`를 성공할 때까지 붙들고** 다시 보낸다
- 만료(403)만 골라내 URL을 재발급하고 **같은 로컬 녹음 파일을 새 URL로 다시 PUT**한다
- 업로드 예산 = `min(URL 만료, 제출 유효시각)` — 둘 다 서버가 주는 값

**차이** — 새 attempt나 새 녹음을 만들지 않고 같은 멱등 키를 유지하는 설계는 촘촘하다. 다만
"재발급해도 같은 S3 key"는 현재 클라이언트 주석과 API 계약에 의존하며, 재발급 전후 key가 같은지 앱이
검증하지는 않는다. 이 불변식은 백엔드 계약이나 서버 코드에서도 확인해야 한다.

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

**판단** — 브리지 코드가 이미 `features/exam/` 안에 7개 파일(`native-data-bridge`, `reanswer-message`,
`go-home-message`, `feedback-data-ready-message`, `feedback-history-message`, `summary-feedback-retry-*`)
로 자란 상태다. **"웹뷰를 유지하는 비용"이 계약 유지 비용으로 나타나는 것**은 맞다. 하지만 파일 수만
으로 네이티브 전환 시점을 정할 수는 없다. 앱·웹 배포 불일치 장애 빈도, 브리지 변경 빈도, 성능·접근성
문제, 네이티브 재구현 비용을 함께 측정한 뒤 피드백 화면을 옮길지 프로토콜을 강화할지 판단한다.

---

## 11. 관측 ← 강한 지점

**수렴 방향** — Sentry가 RN 크래시/오류의 사실상 표준. 제품 분석은 Amplitude/Mixpanel/PostHog.
개인정보 스크러빙은 "해야 한다"는 합의는 있지만 **구현은 대개 SDK 기본 설정에 맡긴다.**
이벤트 이름을 타입으로 강제하는 것도 좋은 팀만 한다.

**우리 위치 — 저장소에서 확인되는 강점은 세 가지다.** "업계 평균을 넘는다"는 상대 평가는 별도
외부 비교 없이는 확정하지 않는다.

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

`previewOperationalError`와 validation catalog도 좋은 검증 도구지만 현재는 개발 화면에서 수행하는
수동 검증이다. 스크러빙과 코드별 payload가 계속 유지되는지를 보증하는 자동 테스트는 없다.

---

## 12. 배포

**수렴 방향** — Expo 앱은 EAS Build/Submit + 환경별 EAS Environment. 버전 출처 단일화.
소스맵 업로드 자동화.

**우리 위치** — 저장소 설정은 전부 있다. `app.config.ts`가 버전만 `package.json`에서 읽어 오는 이유가
주석에 있고,
"릴리스 태그와 대조하는 검사는 아직 없다"는 미완성 사실까지 적어 뒀다. `EXPO_PUBLIC_*`(공개)와
`SENTRY_AUTH_TOKEN`(비공개)의 구분 이유도 `.env.local.example`에 적혀 있다.

**차이** — 저장소 설정만으로 EAS 원격 환경 값, production submit, 소스맵 업로드가 실제로 성공했는지까지
확인할 수는 없다. EAS Update(OTA)를 쓰지 않는 것은 사실이지만 "규모상 아직 필요 없다"고 단정할 근거는
없다. 긴급 JS 수정 빈도와 스토어 심사 대기 비용이 생길 때 도입 여부를 판단한다.

---

## 13. 품질 게이트 ← 두 번째로 먼 지점

**수렴 방향** — RN 앱의 표준 조합은 대략 이렇다.

| 층 | 도구 |
|---|---|
| 정적 | TypeScript + ESLint(또는 Biome/oxlint) |
| 단위 | Jest + React Native Testing Library |
| E2E | Maestro (Detox에서 이동 중) |
| 릴리스 | EAS Build + 스토어 심사 전 preview 배포 |

**우리 위치** — 정적 층만 있다. CI(`lint + typecheck + check:naming`)는 잘 짜여 있다 — concurrency 취소,
`persist-credentials: false`, lint가 실패해도 뒤 검사를 돌려 한 번에 세 결과를 보게 하는 것까지.
**하지만 그 위가 없다.**

**차이의 이유** — 출시 일정. 그리고 이 앱의 상당 부분이 실기기 오디오·권한이라 단위 테스트로
잡히지 않는 것도 사실이다.

**하지만** 순수 함수가 다수 있다(매퍼, `resolve*`, `scaleForWidth`, `decidePartPrelude`,
`findCorrectionSpans`, `normalizeCorrectionSeverity`, `parseNativeDataRequest`, `getEqualJitterDelayMs` …).
이들은 기기도 서버도 필요 없다. **`previewOperationalError`는 테스트를 위해 만든 함수인데
테스트가 없다** — 검증 장치를 만들어 두고 자동화만 안 한 상태다. "40개 이상"은 분류 기준이 없어
재현 가능한 수치가 아니므로 제거했다.

**판단** — 이게 앞의 모든 개선의 전제다. 리팩터링 안전망 없이는 6·7·10 중 어느 것도 손대기 어렵다.
매퍼와 메시지 파서부터 점진 적용할 수 있다. 다만 Expo 57·TypeScript·NativeWind 변환까지 맞추는 테스트
배선 시간을 "반나절"로 확정할 근거는 없다.

---

## 14. 웹 · 앱 코드 공유

**수렴 방향** — 웹과 앱을 함께 만드는 일부 팀은 모노레포(pnpm workspace + Turborepo)로 타입·API
클라이언트·도메인 로직을 공유한다. 팀 소유권과 배포 주기가 다르면 별도 저장소도 여전히 합리적이므로,
모노레포를 단일 수렴점으로 보지는 않는다.

**우리 위치** — 별도 저장소(`soma/web-front-end`, `soma/app-front-end`) + WebView.
`docs/why-new-repo-and-partial-copy.md`에 근거가 있다.

**실제 비용** — 이미 드러나 있다.
- 웹뷰 메시지 계약이 **두 저장소에 각각** 존재하고, 배포 순서가 어긋날 수 있어 버전 협상과
  전환용 별칭이 필요해졌다
- 첨삭 심각도 동의어 표(`major`→`high` 등)와 밑줄 구간 계산 규칙이 "웹 상세 피드백과 같은 규칙"이라는
  주석과 함께 **앱에도 다시 구현**돼 있다
- `formatRetryLabel`이 "웹의 회차 칩과 같은 규칙"이어야 한다는 제약이 주석으로만 유지된다

**판단** — 저장소를 합치는 건 큰 결정이라 지금 권할 일은 아니다. **웹뷰 메시지 계약만이라도** 공유
패키지, JSON Schema, 양쪽 contract test 중 하나로 작성 시점의 불일치를 줄일 수 있다. 다만 앱과 웹이
독립 배포되는 한 공유 패키지도 이미 설치된 구버전 앱과 새 웹의 불일치를 없애지는 못하므로 capability
version과 전환용 별칭은 계속 필요하다.

---

## 15. 문서 · 에이전트 협업 ← 강한 지점

**수렴 방향** — `AGENTS.md`가 AI 에이전트에게 저장소 규칙을 주는 관용구로 빠르게 자리 잡았다.
ADR(결정 기록)은 오래된 관행이지만 실제로 유지되는 곳은 드물다.

**우리 위치** — 둘 다 있고, 밀도가 높다.

- `AGENTS.md` 110줄이 실제 규칙을 담는다. 동결된 워크플로(`specs/`)를 "따르지 말라"고 명시적으로
  방어하는 것까지 포함해서
- `docs/decisions/` 12개. 형식이 고정돼 있고(문제/선택지/결정/코드 흐름 변화/뼈대→구현 차이/기준 충돌)
  **4개 섹션은 사람이 쓴다**는 규칙이 있다
- `docs/how-we-work.md`의 5단계 흐름 — 특히 **3단계에서 사람이 뼈대 코드를 쓴다**는 것.
  "자연어 슈도코드가 아니라 실제 코드 형태여야 stale closure 같은 실제 결함이 4단계에서 드러난다"는
  근거까지 있다
- "기준이 충돌하면 AI가 임의로 정하지 않고 사람에게 묻는다"

**이건 구체적이고 강한 협업 규율이다.** 다만 다른 저장소와의 체계적인 비교 없이 "업계 평균보다
앞서 있다"고 확정하지는 않는다. 선택지 작성·사람의 뼈대 코드·사후 결정 기록은 품질을 높이는 대신
중간 크기 작업의 절차 비용도 만든다.

**차이 — 문서의 노이즈.** `specs/` 14개 폴더와 `docs/superpowers/` 12개 파일이 과거 산출물로 남아 있다.
현재 파일 수는 `docs + specs` 155개, `src` 189개라 "문서 파일이 코드 파일보다 많다"는 주장은 틀리다.
그래도 AGENTS.md가 `specs/`를 따르지 말라고 방어해야 한다는 것은 탐색 비용의 신호다.

**판단** — 바로 삭제하는 결론은 현재 규칙과 충돌한다. AGENTS.md는 `specs/`를 **동결된 archive**로
명시하므로 삭제에는 별도 결정이 필요하다. 먼저 archive index와 현재 문서 진입점을 명확히 하고 기본
탐색에서 제외할지, 감사·맥락 가치보다 노이즈가 크다고 합의되면 그때 삭제한다.

---

## 16. 정리 — 세 문장

1. **기반 구성은 강하다.** 런타임·타입·스타일·인증·업로드·배포 설정은 근거가 분명하고, 관측과
   협업 문서도 구체적이다. 다만 "업계보다 앞선다"는 상대 평가는 별도 근거가 필요하다.
2. **큰 공백은 두 개다** — 서버 상태 계층의 방향이 결정되지 않은 것(§6)과 자동 테스트 층(§13)이다.
   여기에 challenge 운영 오류 코드 공백(§11)이 실제 출시 관점의 후속 과제다.
3. **의도적으로 다르게 간 것들(§3 검증, §4 라우팅, §10 웹뷰, §14 별도 저장소)은 각각 근거가 있고
   문서화돼 있다.** 재검토 시점은 파일 수나 사고 한 번처럼 단일 신호로 정하지 않고, 딥링크 요구,
   배포 불일치 빈도, 변경 비용, 사용자 경험을 함께 본다.
