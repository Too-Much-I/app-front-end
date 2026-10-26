# 답변 익히기: 백엔드 요청 사항

2026-10-19 · 프론트엔드 → 학습 백엔드

답변 익히기 연습 흐름을 아래처럼 바꾸려고 합니다.

```
① 한국어 해석을 보고 조각 퍼즐로 영작 → ② 듣기 + 쉐도잉 → ③ 채점
```

이 문서는 ①에 필요한 데이터 추가 요청(1, 2번)과, 연결 전에 확인할 것(3번)을 정리했습니다.
현재 데이터는 상세 조회 `GET /api/v1/learning/units/{unitId}?level=` 응답의 `result.lessons[].answer.sentences[]`를 기준으로 합니다.

## 1. 문장 조각 경계 `chunks` 추가 (요청)

**왜 필요한가**

① 단계에서는 모범답안 문장을 의미 덩어리 몇 개로 나눠 섞고, 사용자가 한국어 해석을 보며 순서대로 맞춥니다.
연습의 목표는 **답안 구조를 기억하는 것**이므로, 조각은 단어 하나하나가 아니라 "도입 / 누가 / 무엇을 / 어디서·언제 / 이유" 같은 덩어리 단위입니다.

앱에서 쉼표·단어 사이 쉼·전치사로 나누어 보았지만 의미 단위가 보장되지 않았습니다.

| 앱 규칙으로 나눈 결과 (잘못된 예) | 문제 |
| --- | --- |
| `when an employee` / `with sleep problems gets online counseling,` | "수면 문제가 있는 직원"이 갈림 |
| `the Smart Textiles` / `and Privacy discussion` | 행사 이름이 갈림 |
| `my sister` / `and I walked …` | "언니와 나"가 갈림 |

단어 타이밍처럼 콘텐츠를 만들 때 미리 정해서 내려주시면 좋겠습니다.

**필드 형태**

`sentences[]`의 각 문장에 `chunks`를 추가합니다. 조각은 텍스트가 아니라 `words[]`의 위치 번호 범위로 줍니다. 그래야 단어 타이밍과 바로 연결됩니다.

```json
{
  "text": "On the left, a woman is taking a picture by the window.",
  "label": "장면 1",
  "translation": "왼쪽에서는 한 여성이 창가에서 사진을 찍고 있습니다.",
  "audio": { "id": "…", "url": "…", "expiresAt": "…" },
  "words": [ { "text": "On", "start": 0.85, "end": 1.57 }, "… 12개" ],
  "chunks": [
    { "from": 0, "to": 2 },
    { "from": 3, "to": 8 },
    { "from": 9, "to": 11 }
  ]
}
```

- `from`·`to`: `words[]`의 0부터 시작하는 위치 번호이며, `to`도 조각에 포함됩니다. 위 예는 `On the left,` / `a woman is taking a picture` / `by the window.`입니다.
- 첫 조각은 `from: 0`, 마지막 조각은 `to: words.length - 1`이어야 합니다. 조각 사이에 빈틈이나 겹침이 없어야 합니다.
- 문장부호는 `words[].text`에 이미 붙어 있으므로 따로 다루지 않습니다.
- **Part 2~5는 운영에서 모든 문장에 `chunks`가 있어야 합니다(2026-10-26 변경).** 빠진 문장이 오면 앱은 세 단어씩 잘라 임시로 퍼즐을 보여 주고, Sentry에 `LEARNING_CHUNKS_MISSING`(파트·빠진 문장 수)으로 오류를 보고합니다. 테스트 서버에서 아직 만들지 못한 문장은 `chunks: null`(또는 필드 생략)로 주셔도 되지만 같은 오류가 잡힙니다.
- 기존 필드는 그대로 둡니다. 현재 앱은 모르는 필드를 무시하므로 먼저 추가해도 기존 앱이 깨지지 않습니다.

**나누는 규칙**

자르면 안 되는 덩어리:

| 종류 | 예 |
| --- | --- |
| 꾸밈말이 붙은 명사구 | an employee with sleep problems |
| 고유명사·행사·제목 | the Smart Textiles and Privacy discussion |
| 숫자·시간·날짜·금액 | two thirty, June sixth, ninety-five dollars |
| 나란히 이어진 명사 | my sister and I |
| 동사구 숙어 | calms down, look exciting |
| 정해진 표현 | For example, / This is because / I would rather |

자를 수 있는 곳:

- 도입 표현 뒤: `For example,` │ `Actually,` │ `Second,` │
- 긴 주어와 동사 사이: `the discussion on repairable outdoor clothing` │ `starts …`
- 절이 시작되는 곳 앞: │ `when …` / │ `because …` / │ `after …`
- 시간·장소 표현 앞: │ `at two thirty` / │ `by the window.`
- 이어지는 동사구 앞: `changes daily habits` │ `and misses fewer workdays.`

**길이 기준 (답안 구조 기억용)**

| 항목 | 기준 |
| --- | --- |
| 조각 하나 | 2~7단어. 한 단어 조각은 도입 표현(`Actually,` `Second,`)만 허용 |
| 문장 하나 | 2~5조각. 4단어 이하 문장은 나누지 않아도 됨 |
| 글자 수 | 45자 이하 권장 (휴대폰 한 줄) |
| 충돌할 때 | 의미가 우선. 자를 수 없는 덩어리면 길이 기준을 넘어도 그대로 둠 |

**예시 (현재 테스트 콘텐츠의 실제 문장)**

| 문장 | chunks | 나뉜 결과 |
| --- | --- | --- |
| Part 2 IM 12단어 | `0-2, 3-8, 9-11` | On the left, │ a woman is taking a picture │ by the window. |
| Part 4 IM 19단어 | `0-0, 1-6, 7-13, 14-18` | Actually, │ the discussion on repairable outdoor clothing │ starts at two thirty on June sixth │ and conflicts with your call. |
| Part 5 IH 20단어 | `0-1, 2-7, 8-10, 11-15, 16-19` | For example, │ when an employee with sleep problems │ gets online counseling, │ the employee changes daily habits │ and misses fewer workdays. |
| Part 5 AL 20단어 | `0-1, 2-6, 7-13, 14-15, 16-19` | For example, │ after a difficult client meeting, │ a worried employee talks with a counselor, │ calms down, │ and finishes the work. |

Part 4 예의 두 번째 조각은 45자로 기준에 걸리지만, 명사구라서 자르지 않은 경우입니다.

**일관성·버전**

- IM3·IH·AL에서 글자가 똑같은 문장은 조각도 똑같아야 합니다.
- 조각을 바꾸면 `contentVersion`을 새로 올려 주세요. 단어 타이밍과 같은 규칙입니다.
- Part 1(읽기)은 이번 퍼즐 대상이 아니므로 `chunks`가 없어도 됩니다.

**만드는 방법 제안**

520문항 전체를 손으로 나누기는 어려우니, 자동 생성(문장 분석 또는 모델) 후 사람이 검수하는 방식을 제안합니다.
아래 항목은 스크립트로 자동 검사할 수 있습니다.

- 범위가 0부터 마지막 단어까지 빈틈·겹침 없이 이어지는지
- 조각 수(2~5), 단어 수(2~7), 한 단어 조각이 도입 표현인지
- 등급 간 같은 문장의 조각이 같은지
- 숫자·시간 표현 중간에서 잘리지 않았는지

## 2. `label` 역할 이름 통일 (질문)

모든 문장에 `label`이 오는데, 파트마다 쓰임이 다릅니다. 연습 목표가 답안 구조(템플릿) 익히기라서 이 값을 나중에 힌트로 쓸 수 있는지 확인하고 싶습니다.

| 파트 | 현재 label (테스트 콘텐츠 10카드 기준) |
| --- | --- |
| 1 | `문장 1 → 문장 2 → …` 번호만 있음 |
| 2 | 모든 문항이 `장소 → 장면 1 → 장면 2 → 장면 3 → 배경·주변 사물` |
| 3 | `질문을 활용한 첫 문장 → 이유 → 예시 → 결과` 같은 역할 이름과 `시점 → 동행인` 같은 내용 이름이 섞임 |
| 4 | `질문을 활용한 첫 문장 → 항목 1 → 항목 2`와 `사전 등록비 → 당일 등록비`가 섞임. 같은 뜻인 `당일 등록비`·`현장 등록비`가 함께 쓰임 |
| 5 | `질문을 활용한 첫 문장 → 이유 1 → 예시 1 → 이유 2 → 예시 2 → 효과/결과` |

질문:

1. 운영 콘텐츠 전체도 위와 같은 패턴인가요?
2. 역할 이름을 정해진 목록(예: 첫 문장, 장소, 장면, 배경, 이유, 예시, 결과, 항목, 정정)으로 통일할 수 있나요?
3. 문항 내용을 설명하는 이름이 필요하다면, 역할(`role`, 정해진 목록)과 설명(`label`, 자유 문구)을 두 필드로 나눌 수 있나요?

이번 작업에서 label을 화면에 바로 쓰지는 않으므로, 1번 `chunks`보다 우선순위는 낮습니다.

## 3. 연결 전에 확인할 것 (질문)

지금까지 학습 화면은 앱에 넣은 샘플 데이터로만 확인했습니다. 실제 서버 응답으로 확인한 적은 없습니다.

1. 학습 API(`/api/v1/learning/units`, 상세, `capabilities`, `submissions`, `completion`)가 테스트 서버(`api-test.to-teacher.com`)와 운영 서버에 각각 배포되어 있나요? 인증 없이 호출하면 없는 경로도 401로 응답해서, 프론트에서는 경로가 있는지 구분할 수 없습니다.
2. 운영 DB에 콘텐츠가 들어가 있나요? 인수인계 문서 기준으로 테스트는 200카드·360문항·1,000답안, 전체는 520문항입니다.
3. 채점(STT + 체크리스트 판단)이 테스트 서버에서 실제로 동작하나요? 체크리스트는 문항당 몇 개이고, `items[].id`는 어떤 규칙인가요?
4. 실제 응답이 계약 문서와 같은지 확인 부탁드립니다. 특히 다음 항목입니다.
   - Part 4 표의 `tableType` 값
   - Part 1의 `answer.durationSeconds` 포함 여부
   - `capabilities` 응답이 `{ ready, lessonIds }` 형태인지
5. 오류 응답 `code` 목록을 받을 수 있을까요? (`CHECKLIST_NOT_READY`, `CONTENT_VERSION_CHANGED` 외)

## 4. 마지막으로 학습한 파트 조회 (요청, 2026-10-26)

파트 화면에 "이어서 하기" 버튼을 하나 두려고 합니다. 이 버튼을 누르면 사용자가 **가장 최근에 학습한 파트**로 바로 들어가게 할 계획입니다.

지금 있는 `GET /api/v1/learning/resume?part=&level=`은 이 용도로 쓰기 어렵습니다. 파트를 미리 알아야 부를 수 있고, 돌려주는 값도 그 파트 안에서 순서상 첫 미완료 세트입니다. 같은 정보는 이미 목록 응답(`GET /learning/units`)의 `lessons[].completed`로 앱에서 계산하고 있습니다. 앱이 모르는 것은 "어느 파트를 마지막으로 학습했는지" 하나입니다.

요청:

- 등급(`level`)을 받아, 그 등급에서 사용자가 마지막으로 완료한 문항의 `part`(가능하면 `unitId`, `lessonId`도)를 돌려주는 API
- 기준 시각은 완료 기록 저장 시각(Part 1 완료 PUT, Part 2~5 채점 completed)
- 학습 기록이 없으면 `null`

예시:

```
GET /api/v1/learning/last?level=IH
→ { "part": 3, "unitId": "…", "lessonId": "…", "completedAt": "2026-10-26T09:00:00Z" }
```

질문: Part 1은 `common`으로 저장되는데, 등급별 조회에 Part 1 기록을 포함할 수 있나요?

## 회신 부탁드리는 것

| 항목 | 내용 |
| --- | --- |
| 1번 | `chunks` 추가 가능 여부, 일정, 생성·검수 방식 |
| 2번 | label 질문 1~3 답변 |
| 3번 | 질문 1~5 답변, 테스트 계정이나 토큰 발급 방법 |
| 4번 | 마지막 학습 파트 API 제공 가능 여부, 일정, Part 1 포함 방식 |
