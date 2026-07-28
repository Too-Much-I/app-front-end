# Contract: 채점 대기 polling과 재요청

## Route handoff

```ts
type GradingWaitParams = {
  examId: string;
};
```

- route는 시험 식별자만 받는다.
- 문항 번호, 답변 retry count, file key 또는 callback을 전달하지 않는다.
- 개발용 `preview` param은 제거한다.

## Poll grading summary status

```http
GET /api/v1/exams/{examId}/summary
```

Polling에 필요한 lifecycle 값:

```text
PENDING | PROCESSING | COMPLETED | FAILED
```

Client rules:

- 첫 조회는 attempt 시작 직후 실행한다.
- `PENDING`/`PROCESSING`은 응답 종료 3초 뒤 다음 요청을 예약한다.
- 일시적 transport error는 deadline 전까지 같은 방식으로 재조회한다.
- `COMPLETED`만 전체 결과 이동의 권위다.
- caller abort는 화면 해제, deadline, 완료 시 활성 요청을 취소한다.
- summary의 구체적인 envelope mapping은 기존 Raw-to-domain API 경계에서 처리한다.

## Retry exam grading

```http
POST /api/v1/exams/{examId}/grading/retry
```

- request body는 보내지 않는다.
- 시험 식별자 외에 question number, answer retry count, file key가 필요하지 않다.
- HTTP 2xx는 재요청 접수 성공으로 해석한다.
- non-2xx, timeout 또는 network error는 접수 실패로 해석한다.
- 접수 성공 뒤 count 0과 새 180초 deadline으로 두 번째 summary polling을 시작한다.
- 접수 실패 뒤 추가 Retry를 제공하지 않고 terminal error로 전환한다.

## Hook-to-screen UI contract

```ts
type GradingWaitPhase =
  | "polling"
  | "retry-ready"
  | "retry-requesting"
  | "completing"
  | "terminal-error";

type GradingWaitController = {
  phase: GradingWaitPhase;
  gradedPartCount: number;
  retry: () => void;
};
```

- `gradedPartCount`는 항상 0~5다.
- `retry()`는 `retry-ready`에서만 효과가 있고 single-flight다.
- `retry-requesting` 동안 Retry CTA는 disabled다.
- `terminal-error`에는 Retry CTA가 없다.
- 모든 phase는 같은 `GradingWaitScreen`에서 조건부 렌더링한다.
- `onComplete` callback은 count 5가 렌더링된 뒤 최대 한 번 호출된다.
