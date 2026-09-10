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

## 자동 검사와 리뷰의 역할

`pnpm exec tsc --noEmit`은 위 패턴에서 잘못된 상태 조합과 분기 누락을 잡는다.
유니온 모델을 작성했는지, 순수 함수인지, 추상화가 적절한지까지 자동으로 증명하지는 않는다.
이 부분은 기준 구현과 비교해 리뷰한다. `pnpm lint`, `pnpm check:architecture`,
`pnpm check:naming`도 함께 실행한다. 새 린터나 함수형 라이브러리는 필요하지 않다.
