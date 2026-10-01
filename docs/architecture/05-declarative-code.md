# 상태와 판단 로직 작성 규칙

새로 작성하거나 수정하는 상태·판단 로직에 적용한다. 기존 코드는 관련 기능을 수정할 때
점진적으로 맞춘다. 기준은 상태의 의미와 누락을 읽고 검사할 수 있는가이다.
도구는 기존 strict TypeScript와 Oxlint를 사용한다.

## 상태와 유효한 데이터를 묶는다

서로 배타적인 단계는 `status`/`kind` 같은 판별 필드를 가진 유니온으로 표현한다.
`ready`일 때 필요한 데이터는 해당 가지에서 필수로 만들고, 다른 가지는 실제 동작에
맞게 정의한다. 독립적인 불리언까지 하나의 상태 축으로 합치지는 않는다.

기준 구현: [use-challenge-question.ts](../../src/features/challenge/use-challenge-question.ts),
[use-challenge-attempt.ts](../../src/features/challenge/use-challenge-attempt.ts).

```ts
type QuestionState =
  | { status: "loading"; question: null; errorCode: null }
  | { status: "ready"; question: ChallengeQuestion; errorCode: null }
  | { status: "failed"; question: null; errorCode: string | null };

type QuestionStatus = QuestionState["status"];
```

실패에 서버 코드가 없을 수 있으므로 `failed.errorCode`는 nullable이다.
재조회 중 이전 데이터를 유지하는 기능이라면 그 요구를 별도로 모델링한다.
모든 조회에 위 세 상태를 강제하는 공용 제네릭은 만들지 않는다.

이 타입은 잘못된 데이터 조합을 차단한다. 전이 순서, 요청 취소, 오래된 응답 적용 여부는
훅/컨트롤러의 생명주기 로직이 보장해야 한다.

## 전체 분기를 처리하는 곳에 누락 검사를 둔다

앱이 정의한 닫힌 유니온의 모든 경우를 처리할 때 다음 기준을 사용한다.

- 값으로 판단을 반환하는 함수: 명시적인 반환 타입에서 `undefined`를 제외하고 각
  `switch` 가지에서 반환한다. 예: `decidePartPrelude`의 `PartPreludeDecision` 반환 타입.
- `void` 함수 등 반환 타입으로 누락을 잡을 수 없는 곳: 모든 가지를 처리한 뒤
  `const unhandled: never = value`로 검사한다. 런타임의 예외적 입력 처리도 해당 기능의
  기존 오류 정책을 따른다. 예: 시험 스토어의 `completeDirections`.
- 상태별 문구처럼 단순한 전체 대응표: `satisfies Record<Status, string>`으로 키 누락을 검사한다.

기준 구현: [part-prelude.ts](../../src/features/exam/part-prelude.ts),
[exam-session-store.ts](../../src/screens/mock-exam/hooks/exam-session-store.ts).

`isPendingStage`처럼 일부 상태만 판별하는 조건은 단순한 `if`/불리언 식으로 둔다.
전체 대응이 필요한 곳에서 `default`의 성공값이나 타입 단언으로 누락을 숨기지 않는다.
외부의 `string`/`unknown` 입력은 매퍼에서 검증하고, 알 수 없는 값의 fallback을 유지한다.
`noFallthroughCasesInSwitch`는 `break` 누락을 검사하며 유니온 분기 누락 검사는 아니다.

## 판단은 값으로, 실행은 생명주기 소유자에서

도메인 판단 함수는 입력만으로 결과를 반환한다. API, 녹음, 타이머, 로그, React 상태
변경은 훅/컨트롤러에서 수행한다. 판단에 필요한 현재 시간도 인자로 받는다.
`decidePartPrelude`가 판정을 반환하고 스토어가 상태를 바꾸는 흐름을 기준으로 삼는다.

입력 객체와 React 상태를 직접 변경하지 않는다. `readonly`는 변경을 금지할 입력 계약에
사용한다. 함수 안에서 새로 만든 배열이나 Map을 채우는 지역 변경은 허용한다.
순회는 의도가 잘 드러나는 `map`/`filter`/`for...of`를 선택하고, `reduce`나 함수 조합을
일률적으로 강제하지 않는다. 단순 조건을 무조건 다른 파일로 추출하지 않는다.
추출로 가독성과 결합도 기준이 충돌하면 기존 작업 방식에 따라 사용자와 결정한다.

## 정본: 판단 함수 (사람 검증 2026-10-01)

"따라 쓸 기준"으로 사람이 직접 읽고 승인한 구현이다. 아래 기준 구현 중 이 절에 없는 것은 아직 사람이
검증하지 않았다. 정본은 가설이다 — 반례가 나오면 고친다.

| 정본 | 범위 | 보여주는 것 |
|---|---|---|
| [challenge-stage-status.ts](../../src/screens/challenge/challenge-stage-status.ts) | 파일 전체 | 한 파일이 한 주제(스테이지 상태와 그 판정)만 다룬다. 77줄 |
| [part-prelude.ts](../../src/features/exam/part-prelude.ts)의 `PartPreludeDecision`·`decidePartPrelude` | **이 두 선언만** | 입력 union → 결과 union 판정, 명시적 반환 타입 |
| [exam-session-store.ts](../../src/screens/mock-exam/hooks/exam-session-store.ts)의 `decidePartPrelude` 결과 `switch` | 소비하는 `switch`만 | 결과를 받아 부수효과를 실행하고, `default`에 `never` 검사 |

`part-prelude.ts`는 파일 전체가 아니라 판정 부분만 정본이다. 같은 파일에 원본 데이터 정리
(`normalize*`)와 오디오 경로 함수가 함께 있어, 파일째 따라 하면 여러 일을 섞는 것까지 따라 하게 된다.

### 지켜야 할 성질

1. **상태와 그 상태에서 유효한 데이터를 union으로 묶는다.** 공통 타입에 `date?`, `questions?`를 두면
   `ready`인데 데이터가 없는 조합을 타입이 허용한다.
2. **판단 함수는 상태를 바꾸지 않고 결과를 값으로 돌려준다.** 스토어 갱신·네트워크·로그 같은 부수효과는
   호출한 쪽(생명주기 소유자)에 모인다. 그래서 판정과 실행을 따로 읽고 따로 검사할 수 있다.
3. **단순한 조건과 early return으로 위에서 아래로 읽힌다.** 한 호흡에 이해해야 하는 값이 적다.
   판단 함수가 다른 판단 함수를 연달아 부르면 읽는 사람의 시점이 옮겨 다닌다.
4. **이름은 [동사 사전](01-naming-dictionary.md#c-함수--동사-사전)을 따른다.** 분기 판정은 `decide*`,
   여러 입력에서 하나를 고르는 것은 `resolve*`. `resolveChallengeStageCardStatus`는 카드 상태 셋 중
   하나를 고르므로 `resolve*`가 맞다. 화면 상태로 옮기는 `to*`(`toChallengeStageState`)는 사전에 없지만
   저장소에서 14번 쓰인다 — 사전에 넣을지는 아직 정하지 않았다.
5. **이름만으로 입력과 결과를 말할 수 있다.** 함수 이름(동사 사전의 동사 + 판정 대상), 매개변수 이름,
   반환 타입 이름만 보고 "무엇을 받아 무엇을 돌려주는지"를 한 문장으로 말할 수 있어야 한다.
   판단 함수는 대부분 호출하는 쪽에서 읽히고, 그 자리에서는 주석이 아니라 이름과 타입만 보인다.
   주석은 이름으로 말할 수 없는 **이유와 정책**을 적는다(예: `decidePartPrelude` 위의 "Part 1·2는 서두가
   없는 것이 정상이라 `none`, Part 3·4에서 비면 데이터가 깨진 것").

   | 시그니처 | 한 문장 |
   |---|---|
   | `decidePartPrelude(partNumber, partPrelude): PartPreludeDecision` | 파트 번호와 서두를 받아 서두 판정을 돌려준다 ✅ |
   | `resolveChallengeStageCardStatus(question, nextQuestionNumber): ChallengeStageCardStatus` | 문항과 다음 문항 번호로 카드 상태 하나를 고른다 ✅ |
   | 아래 반례의 `resolveSignupSubmitFailure(error, attempts): SignupSubmitDecision` | 가입 제출 실패를… 고른다? ❌ |
6. **누락 검사는 두 장치로 나뉘며, 서로 다른 변경을 잡는다.** 2026-10-01 실험(`pnpm exec tsc --noEmit`):

   | 바꾼 것 | 오류 위치 | 장치 |
   |---|---|---|
   | 결과 union(`PartPreludeDecision`)에 경우 추가 | 소비하는 `switch`의 `const unhandled: never = decision` (TS2322) | `never` 검사 |
   | 입력 union(`ExamPartPrelude`)에 경우 추가 | `decidePartPrelude`의 반환 타입 줄 (TS2366) | 명시적 반환 타입 |

   두 오류는 이어지지 않는다. 결과 union에 경우를 추가해도 판단 함수 안에서는 오류가 나지 않으므로,
   새 값을 실제로 돌려주도록 고치는 것은 사람이 챙긴다. `never` 검사는 `switch`가 처리하고 남은 타입이
   `never`여야 한다는 선언이다. 처리하지 않은 경우가 남으면 그 타입이 선언과 부딪혀 오류가 난다.
   오류 메시지는 타입 불일치만 말하므로 변수 이름을 `unhandled`로 지어 이유를 드러낸다.
7. **`default`는 컴파일 시점에는 누락 탐지, 실행 시점에는 안전망이다.** 타입을 피해 들어온 값(서버가
   타입에 없는 값을 보내는 경우 등)이 실제로 도착하면 앱을 멈추지 않고 기능의 오류 정책(오류 화면 등)을 따른다.

### 반례: 이 정본과 비교해 고칠 점이 드러난 코드

신규 가입 흐름의 제출 실패 판정(2026-09-30, AI 작성) 발췌다. 원본은 이후 고쳐질 수 있으므로 경로를 참조하지
않고 당시 모양을 그대로 옮겼다. union 결과와 값 반환(성질 1·2)은 지켰다.

```ts
export type SignupFailure = { message: string; nextAction: SignupFailureAction };

export type SignupSubmitDecision =
  | { kind: 'resubmit' }
  | { kind: 'restart-enrollment' }
  | { kind: 'phone-required' }
  | ({ kind: 'fail' } & SignupFailure);

export function resolveEnrollmentRestart(attempts: SignupSubmitAttempts): SignupSubmitDecision {
  return attempts.restarted
    ? { kind: 'fail', message: SIGNUP_MESSAGES.unexpected, nextAction: 'retry' }
    : { kind: 'restart-enrollment' };
}

/** signup 실패를 다음 행동으로 바꾼다. 서버 code는 열린 집합이라 알 수 없는 값은 요청 실패로 분류한다. */
export function resolveSignupSubmitFailure(
  error: unknown,
  attempts: SignupSubmitAttempts,
): SignupSubmitDecision {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case 'INVALID_FIREBASE_ID_TOKEN':
      return attempts.proofRetried
        ? { kind: 'fail', message: SIGNUP_MESSAGES.signInAgain, nextAction: 'sign-in-again' }
        : { kind: 'resubmit' };
    case 'FIREBASE_ENROLLMENT_CONFLICT':
    case 'FIREBASE_ENROLLMENT_RESTART_REQUIRED':
      return resolveEnrollmentRestart(attempts);
    // … (다른 code 생략)
    default:
      return { kind: 'fail', ...resolveSignupRequestFailure(error) };
  }
}
```

| 성질 | 어긋난 점 |
|---|---|
| 4 이름 | 분기 판정인데 `resolve*`를 썼다. 사전대로면 `decide*` |
| 5 한 문장 | 이름이 "실패"를 말하지만 돌려주는 것은 "실패 후 다음 행동"이다. `SignupFailure`도 실패가 아니라 안내 문구와 다음 행동을 담은 **안내**다 |
| 3 읽기 흐름 | 판단 함수 안에서 다른 `resolve*`를 다시 불러 시점이 옮겨 다니고, 결과 객체를 삼항으로 통째로 고른다 |

원본은 이 정본을 정한 직후 이름을 고쳤다(2026-10-01): `resolveSignupSubmitFailure` → `decideSignupRecovery`,
`SignupSubmitDecision` → `SignupRecoveryDecision`, `SignupFailure` → `SignupFailureNotice`, 나머지 `resolve*` →
`decide*`. 읽기 흐름(성질 3)은 아직 고치지 않았다.

## 자동 검사와 리뷰의 역할

`pnpm exec tsc --noEmit`은 위 패턴에서 잘못된 상태 조합과 분기 누락을 잡는다.
유니온 모델을 작성했는지, 순수 함수인지, 추상화가 적절한지까지 자동으로 증명하지는 않는다.
이 부분은 기준 구현과 비교해 리뷰한다. `pnpm lint`, `pnpm check:architecture`,
`pnpm check:naming`도 함께 실행한다. 새 린터나 함수형 라이브러리는 필요하지 않다.
