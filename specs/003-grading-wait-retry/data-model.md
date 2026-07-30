# Data Model: 채점 대기 폴링과 재요청

## Exam grading lifecycle status

| Value | Meaning | Client action |
|---|---|---|
| `PENDING` | 채점 접수 후 대기 | polling 유지 |
| `PROCESSING` | 채점 실행 중 | polling 유지 |
| `COMPLETED` | 전체 결과 준비 완료 | completion checks 후 이동 |
| `FAILED` | 현재 채점 시도 실패 | attempt 0은 retry-ready, attempt 1은 terminal-error |

시험 단위 status polling의 `COMPLETED`만 결과 화면 이동의 근거다. retry POST의 성공은
새 채점 시도가 접수됐다는 뜻이며 완료를 의미하지 않는다.

## Grading wait controller

| Field | Type | Purpose |
|---|---|---|
| `phase` | enum | 같은 화면 안의 UI 분기와 허용 action |
| `attempt` | `0 | 1` | 최초/재요청 실패 정책 구분 |
| `gradedPartCount` | `0..5` | `GradingSheet`의 유일한 진행 입력 |
| `attemptStartedAt` | timestamp | 10초 check 기준 |
| `deadlineAt` | timestamp | attempt별 180초 제한 |

route data는 `examId` 하나다. 문항 번호, 답변 retry count, file key는 채점 대기 또는
재요청 lifecycle의 데이터가 아니다.

## State transitions

```text
enter -> polling(attempt=0, count=0)

polling
  -- 10s tick --> count=min(4, count+1)
  -- PENDING/PROCESSING/network error --> polling
  -- COMPLETED --> completing
  -- FAILED/deadline, attempt=0 --> retry-ready
  -- FAILED/deadline, attempt=1 --> terminal-error

retry-ready -- Retry --> retry-requesting(count=0)
retry-requesting
  -- POST /grading/retry HTTP 2xx --> polling(attempt=1, count=0)
  -- POST error/non-2xx --> terminal-error

completing -- sequential count increments --> count=5 -- final hold --> navigate once
terminal-error -- Home --> clear MockExam stack and select Home tab
```

## Invariants

- `gradedPartCount === 5`는 `COMPLETED`를 관찰한 뒤에만 가능하다.
- `retry-ready`는 attempt 0에서만 가능하다.
- user re-request는 controller lifetime 동안 최대 한 번이다.
- 이전 attempt의 controller는 재요청 시작 전에 abort하고, abort된 응답은 state를 바꾸지 않는다.
- settled attempt에는 새 poll이 예약되지 않는다.
- retry POST 성공만으로 결과 화면에 이동하지 않는다.
- navigation callback은 controller lifetime 동안 최대 한 번이다.
- screen unmount 뒤 state update, request, timer, navigation은 발생하지 않는다.
