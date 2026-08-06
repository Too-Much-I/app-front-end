# Data Model: 피드백 기록과 재답변 성장 요약

## Modeling Boundary

서버 응답 타입은 `Raw*`, 검증과 정규화를 통과한 앱 모델은 domain type으로 분리한다. 화면은 raw 필드, nullable 값, 서버 정렬이나 snake/camel case 차이를 직접 해석하지 않는다.

```text
ApiEnvelope<Raw history>
        │
        ▼
      mapper ── invalid item 기록/제외
        │
        ├── ExamHistory
        └── ReanswerQuestionHistory[]
                  │
                  ▼
          calculateReanswerProgress
                  │
                  └── ReanswerProgressState
```

## Entity: RawExamHistoryResult

시험 이력 endpoint의 `result` 원형이다.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `latestCompletedExamId` | `string \| null` | yes | 현재 사용자가 접근 가능한 가장 최근 완료 시험 |
| `trend` | `RawExamTrend` | yes | 서버가 정의한 동일 점수 척도의 최근 추이 |
| `items` | `RawExamHistoryItem[]` | yes | 완료 시각 내림차순 시험 목록 |
| `nextCursor` | `string \| null` | yes | 다음 목록 페이지 cursor |

`latestCompletedExamId`는 현재 page의 첫 item에서 앱이 추측하지 않는다. 빈 재답변 CTA는 pagination 여부와 무관하게 이 필드를 사용한다.

## Entity: RawExamTrend

| Field | Type | Required | Validation |
|---|---|---:|---|
| `maxScore` | `number` | yes | finite, `> 0` |
| `overallAverageScore` | `number \| null` | yes | 값이 있으면 finite, `0 ≤ value ≤ maxScore` |
| `points` | `RawExamTrendPoint[]` | yes | 완료 시각 오름차순, 최대 5개 |

### RawExamTrendPoint

| Field | Type | Meaning |
|---|---|---|
| `examId` | `string` | 시험 식별자 |
| `completedAt` | ISO-8601 string | x축 순서와 날짜 표시 기준 |
| `score` | `number` | 이력용 평균 점수; `trend.maxScore`와 같은 척도 |

앱은 시험 총점 `/200`을 trend `/5` 등으로 환산하지 않는다. `score`와 `maxScore`는 서버가 동일한 승인된 척도로 제공해야 한다.

## Entity: RawExamHistoryItem

| Field | Type | Required | Validation |
|---|---|---:|---|
| `examId` | `string` | yes | 비어 있지 않음 |
| `title` | `string` | yes | 빈 문자열이면 mapper가 기본 표시명으로 정규화 가능 |
| `completedAt` | ISO-8601 string | yes | 유효한 시각 |
| `totalScore` | `number` | yes | finite, `0 ≤ value ≤ maxScore` |
| `maxScore` | `number` | yes | finite, `> 0` |
| `levelEstimate` | `string` | yes | 알려지지 않은 값도 문자열은 보존 |

## Entity: ExamHistory

화면이 사용하는 정규화된 시험 이력이다.

| Field | Type | Meaning |
|---|---|---|
| `latestCompletedExamId` | `string \| null` | 빈 재답변 CTA의 상세 대상 |
| `trend` | `ExamTrend` | 같은 척도의 최근 최대 5점과 전체 평균 |
| `items` | `ExamHistoryItem[]` | 날짜 내림차순의 유효한 시험 기록 |
| `nextCursor` | `string \| null` | 추가 목록 조회 토큰 |

### ExamHistoryItem

- `examId: string`
- `title: string`
- `completedAt: string`
- `totalScore: number`
- `maxScore: number`
- `level: string`
- `gradeBand: "advanced" | "intermediate-high" | "intermediate-mid" | "intermediate-low" | "novice" | "unknown"`

### Grade band mapping

| Levels | Band |
|---|---|
| `AH`, `AM`, `AL` | `advanced` |
| `IH` | `intermediate-high` |
| `IM3`, `IM2`, `IM1` | `intermediate-mid` |
| `IL` | `intermediate-low` |
| `NH`, `NM`, `NL` | `novice` |
| 그 외 | `unknown` |

mapping은 trim 및 대문자 정규화 후 수행한다. 원래 등급 문자열은 배지 문자와 접근성 label에 남기며 색은 배지에만 적용한다.

## Entity: RawReanswerHistoryResult

재답변 이력 endpoint가 반환하는 현재 사용자의 완전한 snapshot이다.

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `generatedAt` | ISO-8601 string | yes | snapshot 생성 시각 |
| `items` | `RawReanswerQuestionHistory[]` | yes | 재답변을 한 번 이상 제출한 고유 문제 모음 |

이 응답은 summary 계산에 포함할 전체 항목을 반환해야 한다. 일부 page만 반환하면 평균과 분모가 달라지므로 pagination을 도입하려면 서버 집계 필드 계약을 별도로 승인받아야 한다.

## Entity: RawReanswerQuestionHistory

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `examId` | `string` | yes | 문제 소속 시험 |
| `questionNumber` | `number` | yes | 양의 정수 문제 번호 |
| `attempts` | `RawAnswerAttempt[]` | yes | 최초 답변과 재답변 회차 |

고유 identity는 `(examId, questionNumber)`이다. endpoint가 같은 identity를 여러 item으로 보내면 mapper가 합친 뒤 `retryCount`로 정렬·중복 제거한다.

## Entity: RawAnswerAttempt

| Field | Type | Required | Validation / Use |
|---|---|---:|---|
| `retryCount` | `number` | yes | 0 이상의 정수. `0`은 baseline, `>0`은 재답변 |
| `status` | `PENDING \| PROCESSING \| COMPLETED \| FAILED` | yes | 완료 회차만 점수 비교에 사용 |
| `score` | `number \| null` | yes | 비교 시 finite, `0 ≤ score ≤ maxScore` |
| `maxScore` | `number \| null` | yes | 비교 시 finite, `>0` |
| `completedAt` | `string \| null` | yes | 완료 회차의 표시/진단 시각 |

같은 `retryCount`가 중복되면 mapper는 임의 선택하지 않고 해당 identity를 비교 불가로 기록한다. 서버 계약 오류를 숨기기 위해 마지막 배열 원소를 택하지 않는다.

## Entity: ReanswerQuestionHistory

정규화된 고유 문제별 이력이다.

- `key: { examId: string; questionNumber: number }`
- `attempts: AnswerAttempt[]` — `retryCount` 오름차순
- `hasPendingRetry: boolean` — `retryCount > 0`이면서 `PENDING | PROCESSING`
- `hasFailedRetry: boolean`
- `mappingIssue: ReanswerMappingIssue | null`

### ReanswerMappingIssue

- `duplicate-retry-count`
- `missing-baseline`
- `invalid-identity`
- `invalid-attempt`

mapper issue가 있는 문제는 계산 시 제외하되 전체 응답 실패로 바꾸지 않는다. 제외 수는 결과에 보존한다.

## Derived Entity: ComparableReanswer

한 고유 문제에서 계산에 실제 사용되는 pair다.

| Field | Type | Rule |
|---|---|---|
| `key` | answer key without retry | `(examId, questionNumber)` |
| `initial` | `AnswerAttempt` | `retryCount=0`, `COMPLETED` |
| `latest` | `AnswerAttempt` | 가장 큰 `retryCount>0`, `COMPLETED` |
| `maxScore` | `number` | initial/latest가 모두 갖고 서로 같아야 함 |
| `deltaRatio` | `number` | `latest.score/maxScore - initial.score/maxScore` |
| `improved` | `boolean` | `latest.score > initial.score` |

더 큰 retry 회차가 pending이어도 latest completed를 사용한다. pending 존재 사실은 별도 상태/문구를 위해 유지한다.

## Derived Entity: ReanswerProgressSummary

| Field | Type | Rule |
|---|---|---|
| `averageDeltaRatio` | `number` | 모든 comparable `deltaRatio`의 산술 평균, 중간 반올림 없음 |
| `displayDeltaPercentagePoints` | `number` | `averageDeltaRatio × 100`, 소수 첫째 자리 반올림, `-0`은 `0` |
| `improvedCount` | `number` | `improved=true`인 고유 문제 수 |
| `comparableCount` | `number` | comparable pair 수; 배너 분모 |
| `excludedCount` | `number` | 완료 재답변은 있으나 비교에서 제외된 고유 문제 수 |
| `pendingCount` | `number` | 완료 집계와 별개로 pending 재답변이 있는 고유 문제 수 |

표시 예: `평균 +12.4%p`, `6/8문제 향상`. 0과 음수도 각각 `0.0%p`, `-3.2%p`처럼 실제 값을 표시하고 긍정 색이나 성공 문구로 과장하지 않는다.

## UI State Models

### Independent request state

각 hook은 서로 독립적인 discriminated union을 반환한다.

```text
idle → loading → ready
          │        │
          └──────► error ── retry ──► loading
```

- `idle`: 아직 탭이 요청을 시작하지 않음
- `loading`: 이전 stale 값을 성과나 empty로 표시하지 않음
- `ready`: mapper를 통과한 domain data 보유
- `error`: retry callback과 사용자용 오류 상태 보유

unmount, 새 요청 또는 retry는 이전 `AbortController`를 abort한다. abort된 요청은 `error`로 전환하지 않는다.

### ReanswerProgressState

ready data는 다음 중 하나로 파생된다.

| State | Condition | UI |
|---|---|---|
| `summary` | `comparableCount > 0` | 읽기 전용 성과 배너 |
| `pending-only` | completed retry 없음, pending retry 있음 | 채점 대기 안내; CTA 없음 |
| `empty` | completed/pending retry 모두 없음 | 최근 완료 시험이 있으면 재답변 CTA |
| `incomparable` | completed retry 있음, `comparableCount = 0` | 비교 불가/다시 불러오기 안내; CTA 없음 |

`empty`에서 `latestCompletedExamId=null`이면 CTA 대신 모의고사 시작 안내로 한 단계 더 분기한다.

## Relationships

```text
ExamHistoryItem 1 ────── * ReanswerQuestionHistory
      examId                    examId
                                  │
                                  └── 1 ────── * AnswerAttempt
                                      question       retryCount

ReanswerQuestionHistory 1 ── 0..1 ComparableReanswer
ComparableReanswer      * ────── 1 ReanswerProgressSummary
```

삭제되거나 현재 사용자가 접근할 수 없는 exam은 서버 collection에 포함하지 않는 것이 원칙이다. CTA 시점에 접근 권한이 사라질 수 있으므로 WebView load/API 실패는 history refresh로 복구한다.
