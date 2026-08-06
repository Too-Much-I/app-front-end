# History API Contract

**Status**: Proposed prerequisite — backend 확인 및 제공 전에는 앱 구현을 시작하지 않는다.

## Shared Rules

- 두 endpoint는 기존 `apiFetch<T>()`를 통해 호출하고 `ApiEnvelope<T>`를 반환한다.
- 데이터는 서버가 **현재 요청 문맥의 사용자 소유 범위**로 제한한다.
- 앱은 `userId`를 query, path 또는 임의 header로 전달하지 않는다. 현재 배포의 요청 문맥만으로 사용자 식별과 소유권 검증이 불가능하면 계약 미충족이다.
- 삭제됐거나 접근 권한이 없는 시험과 답변을 다른 사용자의 데이터로 대체하지 않는다.
- 날짜는 timezone offset을 포함한 ISO-8601 문자열이다.
- 점수는 JSON number 또는 `null`이며 숫자 문자열로 보내지 않는다.
- unknown enum/grade는 앱 mapper가 안전하게 처리하지만, 필수 object/array가 누락된 성공 응답은 계약 오류로 취급한다.
- 요청 취소를 위한 `AbortSignal`을 지원하고 기존 기본 timeout 정책을 따른다.

공통 envelope:

```json
{
  "isSuccess": true,
  "code": "COMMON200",
  "message": "성공입니다.",
  "result": {}
}
```

## Contract 1: Completed Exam History

### Request

```http
GET /api/v1/exams/history?limit=20&cursor={opaqueCursor}
```

- `limit`: optional, 서버 기본값 20, 허용 범위는 backend가 정하되 앱과 공유한다.
- `cursor`: optional opaque token. 앱은 내용을 파싱하거나 생성하지 않는다.
- 첫 요청에는 cursor를 보내지 않는다.

### Success result

```json
{
  "latestCompletedExamId": "exam-2026-08-03",
  "trend": {
    "maxScore": 5,
    "overallAverageScore": 3.8,
    "points": [
      {
        "examId": "exam-1",
        "completedAt": "2026-07-10T09:30:00+09:00",
        "score": 3.1
      },
      {
        "examId": "exam-2",
        "completedAt": "2026-07-18T11:00:00+09:00",
        "score": 3.6
      },
      {
        "examId": "exam-2026-08-03",
        "completedAt": "2026-08-03T14:20:00+09:00",
        "score": 4.2
      }
    ]
  },
  "items": [
    {
      "examId": "exam-2026-08-03",
      "title": "토익 스피킹 모의고사",
      "completedAt": "2026-08-03T14:20:00+09:00",
      "totalScore": 160,
      "maxScore": 200,
      "levelEstimate": "IH"
    }
  ],
  "nextCursor": null
}
```

### Invariants

1. `items`에는 채점이 완료됐고 현재 사용자가 접근 가능한 시험만 포함한다.
2. `items`는 `completedAt` 내림차순이다. 같은 시각이면 `examId`의 안정적인 tie-break 순서를 서버가 유지한다.
3. `latestCompletedExamId`는 전체 결과 중 가장 최근 시험이며 현재 page에 그 item이 없더라도 정확해야 한다.
4. 시험이 없으면 `latestCompletedExamId=null`, `items=[]`, `nextCursor=null`, `trend.points=[]`, `trend.overallAverageScore=null`이다.
5. `trend.points`는 전체 이력 중 최신 최대 5개를 선택한 뒤 `completedAt` 오름차순으로 반환한다.
6. 모든 trend `score`와 `overallAverageScore`는 하나의 `trend.maxScore` 척도를 공유한다.
7. backend는 기록용 평균 점수 산식을 소유한다. 앱은 `totalScore/maxScore`를 `/5`로 환산해 trend를 만들지 않는다.
8. `totalScore`와 `maxScore`는 개별 시험의 원래 총점 척도이며 `0 ≤ totalScore ≤ maxScore`, `maxScore > 0`이다.
9. `levelEstimate`는 배지에 표시할 TOEIC Speaking level 문자열이다. 앱은 알려진 band로 색을 고르되 원문을 보존한다.

### Paging behavior

- 다음 page에도 `trend`와 `latestCompletedExamId`는 같은 snapshot 기준의 동일한 값이어야 한다.
- cursor가 만료 또는 잘못됐으면 성공 빈 배열 대신 명시적 client error를 반환한다. 앱은 첫 page 재조회 동작을 제공한다.
- pagination 중 새 시험이 완료돼 순서가 달라지지 않도록 cursor는 가능하면 snapshot을 고정한다.

## Contract 2: Reanswer History Snapshot

### Request

```http
GET /api/v1/exams/reanswers/history
```

이 endpoint에는 `examId`, `questionNumber`, `userId`를 보내지 않는다. 서버가 현재 사용자에게 속하며 재답변 회차가 하나 이상인 모든 고유 문제를 발견한다.

### Success result

```json
{
  "generatedAt": "2026-08-03T15:00:00+09:00",
  "items": [
    {
      "examId": "exam-2026-08-03",
      "questionNumber": 3,
      "attempts": [
        {
          "retryCount": 0,
          "status": "COMPLETED",
          "score": 3,
          "maxScore": 5,
          "completedAt": "2026-08-03T14:20:00+09:00"
        },
        {
          "retryCount": 1,
          "status": "COMPLETED",
          "score": 4,
          "maxScore": 5,
          "completedAt": "2026-08-03T14:45:00+09:00"
        },
        {
          "retryCount": 2,
          "status": "PROCESSING",
          "score": null,
          "maxScore": 5,
          "completedAt": null
        }
      ]
    }
  ]
}
```

### Invariants

1. `items`는 재답변 `retryCount>0` 회차가 하나 이상 있는 문제만 포함한다. 최초 답변만 있는 모든 시험 문제를 보내지 않는다.
2. identity는 `(examId, questionNumber)`이며 각 identity는 응답에 한 번만 나타난다.
3. 각 item은 비교 baseline인 `retryCount=0` 회차와 존재하는 모든 `retryCount>0` 회차를 포함한다.
4. `retryCount`는 0 이상의 정수이고 한 item 안에서 중복되지 않는다. 배열 정렬을 신뢰하지 않아도 되지만 서버는 오름차순을 권장한다.
5. status는 `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` 중 하나다.
6. `COMPLETED`는 score와 maxScore가 확정됐음을 뜻한다. 데이터 손상 사례를 앱이 구분할 수 있도록 필드 자체는 nullable contract로 두지만 정상 응답은 finite `score`, finite `maxScore>0`, `0 ≤ score ≤ maxScore`를 만족해야 한다.
7. 같은 문제의 정상 baseline과 완료 retry는 같은 `maxScore`를 사용한다. 불일치하면 앱은 그 문제를 비교에서 제외한다.
8. 더 큰 retry가 pending/processing이어도 이전 latest completed는 계산에 사용할 수 있어야 하므로 완료 회차를 생략하지 않는다.
9. `items=[]`는 현재 사용자에게 completed, pending 또는 processing 재답변이 모두 없다는 뜻이다. 조회 실패나 권한 실패를 빈 성공으로 변환하지 않는다.
10. `generatedAt`의 모든 item을 포함한 **완전한 snapshot**이어야 한다. 부분 pagination은 전체 평균과 분모를 손상하므로 현재 계약에서 허용하지 않는다.

### Client calculation contract

서버는 최종 `%p` 문자열만 반환하지 않는다. 앱은 다음 규칙을 검증 가능한 순수 함수로 적용한다.

1. 문제별 baseline: `retryCount=0 && status=COMPLETED`
2. 문제별 latest: `retryCount>0 && status=COMPLETED` 중 가장 큰 retryCount
3. comparable 조건: 두 점수와 만점이 finite, `maxScore>0`, 점수가 `[0,maxScore]` 범위, 두 maxScore가 동일
4. `deltaRatio = latestScore/maxScore - initialScore/maxScore`
5. `averageDeltaPercentagePoints = mean(deltaRatio) × 100`
6. 화면 표시 직전에만 소수 첫째 자리 반올림하고 negative zero를 `0.0`으로 정규화
7. 향상 문제: `latestScore > initialScore`

중간 retry 점수나 서로 다른 문제의 원점수를 직접 평균하지 않고, 100점 환산 점수도 생성하지 않는다.

## Error Semantics

| Situation | Expected response | Client behavior |
|---|---|---|
| 사용자 문맥 없음 | `401` | 오류 상태; 로그인/세션 정책이 정의되기 전 빈 상태 표시 금지 |
| 해당 데이터 접근 불가 | `403` | 오류 상태; 다른 사용자 데이터 또는 cached fallback 금지 |
| cursor invalid/expired | `400` 계열 명시 code | 시험 이력 첫 page 재조회 제공 |
| server timeout/failure | `5xx` 또는 request rejection | 해당 탭만 오류, 명시적 retry |
| 정상적으로 기록 없음 | `200` + 계약에 정의된 빈 result | 실제 empty/pending 분기 수행 |
| malformed success payload | `200`이더라도 mapper contract error | empty로 변환하지 않고 오류/비교 불가 처리 |

정확한 application `code` 문자열은 backend 표준과 함께 확정한다. 앱 화면은 내부 code를 그대로 사용자에게 노출하지 않는다.

## Backend Readiness Gate

다음 항목이 확인돼야 구현 단계로 넘어갈 수 있다.

- [ ] 두 route와 field naming이 backend에 승인됨
- [ ] 현재 앱 요청에서 사용자 소유 범위를 식별·검증할 수 있음
- [ ] 시험 trend의 점수 의미와 `maxScore` 산식이 확정됨
- [ ] `latestCompletedExamId`가 전체 history 기준으로 제공됨
- [ ] 재답변 endpoint가 baseline과 모든 retry status를 포함한 완전한 snapshot을 제공함
- [ ] 정상 empty와 인증·권한·서버 오류가 다른 응답으로 구분됨
- [ ] 대표 payload를 앱 mapper fixture로 공유할 수 있음
