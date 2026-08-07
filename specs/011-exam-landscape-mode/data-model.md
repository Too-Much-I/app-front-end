# Data Model: Part 4 표 가로 전체화면

이 기능은 API나 영속 데이터를 추가하지 않는다. 기존 `ExamTableContext`를 그대로 사용하며 아래
모델은 현재 앱 실행 중의 UI/lifecycle 상태다.

## Screen Orientation Mode

전역 native orientation 요청과 UI exception이 공유하는 단일 상태다.

| State | Meaning | Modal/notice behavior |
| --- | --- | --- |
| `portrait` | 기본 상태이며 portrait lock을 기대함 | landscape table 닫힘, 일반 자세 안내 활성 |
| `entering-landscape` | 버튼이 요청됐고 capability/lock 확인 중 | table shell 표시 가능, 일반 자세 안내 억제 |
| `landscape` | native landscape lock 성공 | table modal 표시, 일반 자세 안내 억제 |
| `restoring-portrait` | close/back/이탈로 portrait 복구 중 | table modal 유지, 일반 자세 안내 억제 |

### Validation rules

- `portrait`에서 발생한 전용 button event만 `entering-landscape`로 전환할 수 있다.
- accelerometer나 window ratio event는 `entering-landscape` 전환을 만들 수 없다.
- transition 상태에서는 추가 enter event를 무시한다.
- restore event는 모든 non-portrait state에서 허용하며 native chain의 마지막 요청이 portrait가
  되게 한다.
- native landscape request 실패는 `portrait`로 돌아간다.
- native portrait request 실패도 UI state는 `portrait`로 복구하고 일반 자세 안내를 다시 켠다.

## Active Part 4 Table

`ExamSessionScreen`이 현재 controller state에서 파생하는 nullable view model이다.

| Field | Type | Source |
| --- | --- | --- |
| `table` | `ExamTableContext` | reading prelude 또는 current Part 4 question의 canonical table |
| `source` | `reading` \| `question` | 현재 phase에 따른 presentation context |
| `isLandscapeActionAvailable` | boolean | table 존재, live exam scope, orientation mode가 portrait인지 여부 |

### Validation rules

- Part 4 directions, invalid prelude, Part 5와 submission 상태에는 active table이 없다.
- reading에서 question으로 바뀌어도 canonical table이 계속 있으면 landscape modal을 유지할 수
  있다.
- active table이 null이 되는 순간 portrait restore를 요청한다.
- reanswer의 table은 active live-exam table model에 들어오지 않는다.

## Landscape Table Presentation

영속 entity가 아니라 modal이 소비하는 derived state다.

| Field | Type | Rule |
| --- | --- | --- |
| `visible` | boolean | active table이 있고 orientation mode가 portrait가 아닐 때 true |
| `table` | `ExamTableContext` | 세로 renderer와 동일 reference/content |
| `isTransitioning` | boolean | entering/restoring일 때 true; 중복 action 방지 |
| `statusBarHidden` | true | modal 수명 동안 고정 |

## State Transitions

```text
app/screen mount
    → portrait lock best effort
    → portrait

portrait + landscape button
    → entering-landscape
    → support false / lock reject → portrait fallback
    → lock success → landscape

entering-landscape or landscape
    + close / Android back / active table removed / screen unmount
    → restoring-portrait
    → portrait lock success or failure
    → portrait
```

## Relationships and Ownership

- `OrientationProvider` owns `Screen Orientation Mode` and native transition serialization.
- `PortraitOnlyNotice` reads the mode only to decide whether its sensor-derived notice is allowed.
- `ExamSessionScreen` derives `Active Part 4 Table`, invokes provider actions, and owns modal placement.
- `Part4TableLandscapeModal` consumes presentation state and emits only close.
- `useExamSessionController` owns exam progression independently and is not modified by orientation state.
