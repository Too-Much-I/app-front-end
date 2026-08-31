# Dependency-Cruiser 의존성 분석

조사 시점: 2026-08-31 (`main`, 현재 워킹트리)

## 범위와 읽는 법

- `index.ts`, `App.tsx`, `src/`의 191개 모듈을 Dependency-Cruiser 18.2.0으로 조사했다.
- 내부 의존성은 611개다. 런타임 494개, 타입 전용 117개이며 미해결 import는 0개다.
- [생성 그래프](generated/dependency-graph.mmd)는 기능·화면별 폴더로 접었다. 화살표는
  런타임과 타입 의존성을 모두 포함하므로, 양방향 화살표가 곧 런타임 순환 참조라는 뜻은 아니다.
- 외부 패키지와 `tailwind.config.js` 같은 분석 범위 밖 루트 설정은 그래프에서 제외했다.

## 먼저 볼 결론

| 구분 | 결과 | 판단 |
|---|---:|---|
| 런타임 순환 참조 | 0개 | Metro 실행을 깨뜨릴 순환 고리는 없다 |
| 타입 포함 순환 참조 | 0개 | `ExamSessionPhase` 계약을 공용 타입으로 옮겨 해소했다 |
| 미해결 import | 0개 | `@/*` 별칭을 포함해 모두 해석됐다 |
| 고아 모듈 | 0개 | 타입 전용 import까지 포함하면 사용처 없는 모듈은 없다 |
| 공용 위치 + 소비자 1개 | 5개 | 1개만 이동 후보이고 나머지는 진입점 어댑터 또는 오탐이다 |

## 순환 참조 결과

런타임과 타입 의존성을 모두 포함해 순환 참조가 없다. 최초 조사에서는 아래 타입 순환이 있었다.

```text
lib/amplitude.ts
  -- type --> lib/analytics-events.ts
  -- type --> screens/mock-exam/hooks/use-exam-session-controller.ts
  -- runtime --> lib/amplitude.ts
```

`ExamSessionPhase`의 소유권을 `src/types/exam.ts`로 옮긴 뒤 스토어와 이벤트 계약이 그 타입을 직접
참조하도록 바꿨다. 이벤트를 생산하는 컨트롤러를 이벤트 타입이 역으로 참조하던 고리가 사라졌다.

## 기존 아키텍처 그림과 비교

비교 기준은 정본인 `diagrams/02-architecture.drawio`의 현재 워킹트리 버전이다.

| 기존 그림의 설명 | 실제 의존성 | 판정 |
|---|---|---|
| `challenge → exam/upload-answer-audio` | `use-challenge-submission.ts:16-20` | 그대로 존재한다 |
| `lib/api → auth`가 유일한 역방향 | `client.ts:1`이 `auth-controller.ts`를 참조 | 그대로 존재한다. 파일 순환은 없지만 폴더 수준은 `lib ↔ auth`다 |
| `audio`를 세 녹음 흐름이 공유 | 시험·재답변·챌린지에서 직접 참조 | 현재도 맞다 |
| 공용 계층은 도메인을 모른다 | `analytics-events → types/exam`, `PortraitOnlyNotice → orientation` | 제품 이벤트 계약과 전역 UI 예외는 남아 있다 |
| 화면은 기능 계층에 기대고 화면끼리는 분리 | 화면 간 직접 import 0개 | 컴포넌트 이동 후 그림과 일치한다 |

최초 조사에서 발견한 화면 간 의존성 세 개는 다음 위치 이동으로 해소했다.

- `AudioWaveform` → `features/audio/components`: 시험·마이크 테스트·챌린지·재답변 네 곳이 사용
- `GradingRabbitBanner` → `features/exam/components`: 채점 대기와 재답변 두 곳이 사용

이제 challenge와 reanswer 화면은 mock-exam 화면 구현을 직접 참조하지 않는다.

공용 UI의 역방향도 하나 있다. `src/components/ui/PortraitOnlyNotice.tsx:4-5`는
`features/orientation`의 훅과 컨텍스트를 직접 사용한다. 전역 오버레이라는 역할에는 맞지만
`components/ui`를 도메인 비인지 공용 계층으로 정의한 그림과는 맞지 않는다.

또한 그림의 `src/components` 공용 칸과 달리 `src/components/exam/Part4Table.tsx`는 이름과 타입 모두
exam 도메인을 안다. 공용의 의미가 “모든 도메인에 중립”인지 “여러 화면에서 재사용”인지 문서와
폴더가 서로 다른 정의를 사용하고 있다.

## 공용 위치인데 소비자가 하나인 모듈

| 모듈 | 유일한 소비자 | 판단 |
|---|---|---|
| `components/ui/TickingClock.tsx` | `HomeScreen.tsx` | 현재만 보면 `screens/home` 응집도가 더 높다 |
| `components/ui/PortraitOnlyNotice.tsx` | `App.tsx` | 전역 오버레이라 소비자 수는 자연스럽지만, orientation 의존 때문에 위치는 재검토 대상이다 |
| `lib/clarity.ts` | `index.ts` | 앱 시작 시 한 번 초기화하는 SDK 어댑터라 정상이다 |
| `theme/use-app-fonts.ts` | `App.tsx` | 앱 시작 게이트 전용 훅이라 정상이다 |
| `theme/tokens.js` | `theme/index.ts` | 분석 밖의 `tailwind.config.js`도 읽으므로 실제 단일 소비자가 아니다 |

소비자가 하나라는 사실만으로 이동시키면 미래 재사용을 어렵게 할 수 있다. 현재 구조에서 명확한
후보는 `TickingClock` 하나이고, `PortraitOnlyNotice`는 소비자 수보다 의존 방향이 핵심이다.

## 결합이 집중된 모듈

fan-in 상위는 `Text` 53, `theme/index` 53, `Pressable` 40이다. 공용 primitive와 토큰에 의존성이
모이는 것은 의도와 일치한다. 타입 모듈도 `types/exam` 39, `types/challenge` 22로 높지만 계약을
모은 결과라 그 자체는 문제가 아니다.

fan-out 상위 화면은 `ExamSessionScreen` 24, `TenSecondChallengeScreen` 19,
`FeedbackScreen` 17이다. 화면은 조립 지점이라 수치만으로 분해할 근거는 부족하다. 다만 앞의 화면 간
직접 import와 결합될 때 변경 파급이 커지므로 새 기능을 붙일 때 먼저 다시 볼 지표다.

## 우선순위

1. `PortraitOnlyNotice`를 공용 UI로 볼지 orientation 기능 UI로 볼지 정한다.
2. `TickingClock`은 재사용 계획이 없다면 Home 화면 가까이 두는 것을 검토한다.

Dependency-Cruiser는 계속 관찰용으로만 두며 CI 게이트는 추가하지 않았다.
