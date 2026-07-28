# Research: 파트별 시험 흐름과 복구 접근성

## Decision 1: 사전 단계를 controller의 명시적 phase로 둔다

- **Decision**: `part3-intro`, `part4-reading`, `part-prelude-error`를 기존 시험 phase union에
  추가한다.
- **Rationale**: 사전 안내가 진행되는 동안 문제 준비 timer나 recorder가 뒤에서 시작되는 것을
  상태 경계에서 차단할 수 있다. 완료 callback은 현재 phase를 다시 확인해 중복 이벤트도 무시한다.
- **Rejected**: 화면 내부 boolean만으로 사전 단계를 표시하는 방식은 controller 상태와 화면 상태가
  갈라져 timer·recording race를 만들 수 있다.

## Decision 2: raw optional 필드를 세션 단위 prelude로 정규화한다

- **Decision**: raw 문항의 `partIntroText`, `guideAudioUrl`, `tableContext`는 optional로 유지하고,
  mapper가 세션에 존재하는 Part 3/4만 검사해 valid/invalid discriminated union을 생성한다.
- **Rationale**: UI는 nullable 필드 조합을 추측하지 않고 유효한 데이터 또는 차단 오류만 처리한다.
  Part 1-only trial 세션에는 존재하지 않는 Part 3/4 데이터를 요구하지 않는다.
- **Rejected**: mapper에서 throw하면 전체 세션 진입이 막히고 사용자가 어느 파트 데이터가 잘못됐는지
  설명받기 어렵다.

## Decision 3: Part 4 표는 한 데이터 원본을 두 구간에 렌더링한다

- **Decision**: Q8의 표를 canonical shared table로 삼고, 같은 객체를 45초 사전 읽기와 Q8~Q10
  문제 화면에 모두 제공한다. Q9/Q10은 표를 생략하거나 Q8과 동일하게 반복할 수 있다.
- **Rationale**: “정규화”는 화면에서 한 번만 보인다는 의미가 아니다. 동일 표를 두 UI 단계에서
  보여주면서 데이터 충돌과 중복 소유만 제거한다.
- **Rejected**: Q8~Q10 표를 각각 독립적으로 사용하면 서버 응답이 충돌할 때 문제마다 다른 정보를
  보여줄 수 있다. 서로 다른 표를 합치는 것도 원본 의미를 훼손한다.

## Decision 4: Part 3 번들 오디오는 정적 resolver를 사용한다

- **Decision**: mock은 `/assets/audio/part3_intro.wav` 논리 경로를 사용하고 resolver가 정적
  `require()`로 변환한다. HTTP(S) URL은 native remote audio source로 변환한다.
- **Rationale**: Metro는 동적 문자열 경로를 번들에 포함하지 않으므로 로컬 asset은 정적 선언이
  필요하다. 알 수 없는 local path는 재생 시도 전 invalid로 분류한다.
- **Rejected**: 모든 URL을 `{ uri }`로 전달하면 번들 내부 상대 경로가 네이티브에서 재생되지 않는다.

## Decision 5: Part 4 timer는 실제 노출 시간만 센다

- **Decision**: 표 layout 완료와 화면 focus/AppState active를 모두 만족한 동안만 45초 countdown을
  진행한다. inactive/blur 동안 잔여 시간을 보존하고, 사용자의 준비 완료 action은 같은 guarded
  완료 전환을 사용해 남은 읽기 시간만 생략한다.
- **Rationale**: 사용자가 표를 볼 수 없는 동안 준비 시간을 소비하지 않으며 종료/blur 경쟁에서도
  phase guard가 한 번만 다음 단계로 이동한다.
- **Rejected**: 단순 mount 기준 `setTimeout(45초)`은 background에서도 만료된다.

## Decision 6: 제출 최종 분기만 전용 ScrollView로 만든다

- **Decision**: `submission-barrier`와 `completed` 분기를 safe-area 내부 vertical ScrollView로
  감싼다. 실패 목록은 상단부터 흐르게 하고 짧은 완료 상태만 중앙 정렬한다.
- **Rationale**: 일반 문제 화면의 독립적인 콘텐츠/하단 녹음 UI 구조는 보존하면서 최대 11개 실패
  카드와 큰 글자에서도 마지막 버튼까지 접근할 수 있다.
- **Rejected**: 시험 전체를 하나의 ScrollView로 바꾸면 녹음 control과 progress header의 배치 및
  기존 interaction을 불필요하게 변경한다.

## Integration dependency

실제 `/api/v1/exams` 응답의 Part 3 필드 위치·remote URL 형식과 Part 4 반복 표 규칙은 backend
연결 후 확인해야 한다. 그 전에는 mock과 typed invalid 상태로 UI 및 상태 안전성을 검증한다.
