# Sentry 운영 오류 보고 요구사항

**작성일**: 2026-08-12
**상태**: 검토 대기
**목적**: 운영자가 조치할 가치가 있는 사용자 차단 오류만 Sentry에서 확인하고, 정상 중단과
개인정보는 수집하지 않는다.

## 1. 기본 원칙

1. 예외가 한 번 발생했다는 이유만으로 보내지 않는다.
2. 사용자에게 오류 안내나 복구 행동이 표시되는 **확정 실패 시점**에 보낸다.
3. 자동 재시도와 polling 중간 실패는 보내지 않는다.
4. 자동 복구에 성공하면 실패 이벤트를 보내지 않는다.
5. 같은 작업 시도와 같은 오류 코드는 한 번만 보낸다.
6. 사용자가 직접 재시도를 시작하면 새 작업 시도로 본다.
7. 사용자 취소, 권한 거부, 화면 이탈, background 전환과 abort는 오류로 보내지 않는다.
8. 이벤트 전송 실패가 사용자 흐름이나 기존 오류 처리를 바꾸면 안 된다.
9. Sentry가 활성화된 운영 빌드에서만 전송한다.

## 2. 수집할 오류와 전송 시점

| 오류 코드 | 수집 범위 | 전송 시점 | 중복 단위 |
|---|---|---|---|
| `AUTH_BOOTSTRAP_FAILED` | 앱 시작 또는 동의 제출 뒤 인증 준비 실패 | 인증 화면이 재시도 상태로 확정될 때 | 인증 시도당 1회 |
| `EXAM_SESSION_CREATE_FAILED` | 모의고사 세션 또는 필수 시작 데이터 생성 실패 | 시험 시작이 차단되고 사용자에게 실패 안내가 표시될 때 | 시작 시도당 1회 |
| `EXAM_REQUIRED_AUDIO_FAILED` | 필수 안내·문제 음성 누락 또는 재생 실패 | 진행이 차단되거나 필요한 음성 없이 진행된다는 사실이 확정될 때 | cue당 1회 |
| `EXAM_PRELUDE_FAILED` | Part 3/4 사전 자료 누락·오배치·손상·충돌 | 사전 자료 오류 화면으로 전환될 때 | 시험 흐름당 1회 |
| `ANSWER_RECORDING_FAILED` | 마이크 테스트 또는 답변의 녹음 준비·종료·완성 파일 검증 실패 | 녹음 오류 복구 상태로 확정될 때 | 녹음 시도당 1회 |
| `ANSWER_SUBMISSION_FAILED` | 업로드 준비·파일 업로드·서버 접수 최종 실패 | 내장 재시도가 끝나고 답변 작업이 실패로 확정될 때 | 답변 시도당 1회 |
| `EXAM_GRADING_FAILED` | 서버 실패·최종 timeout·채점 재요청 접수 실패 | 최초 대기 실패가 아니라 사용자 재시도 후 terminal error가 확정될 때 | 시험 흐름당 1회 |
| `FEEDBACK_PAGE_LOAD_FAILED` | 피드백 문서 네트워크·HTTP 로드 실패 | 실제 오류 UI가 표시될 때 | 문서 로드 시도당 1회 |
| `FEEDBACK_DATA_LOAD_FAILED` | 문서가 요청한 초기 핵심 데이터를 앱이 전달하지 못함 | 실패 응답이 전달되어 콘텐츠를 완성하지 못할 때 | 데이터 요청 시도당 1회 |
| `FEEDBACK_HISTORY_LOAD_FAILED` | 기존 표시 데이터가 없는 최근 피드백·이력 조회 실패 | 사용자에게 오류·재시도 상태가 표시될 때 | 화면 조회 시도당 1회 |
| `SUMMARY_FEEDBACK_RETRY_FAILED` | 종합 피드백 재생성 접수·polling·timeout 실패 | 공유 작업이 최종 실패로 확정될 때 | 재생성 작업당 1회 |
| `REANSWER_QUESTION_LOAD_FAILED` | 재답변 문제 원문 조회·계약 검증 실패 | 문제 조회 실패 화면으로 전환될 때 | 재답변 시도당 1회 |
| `REANSWER_SUBMISSION_FAILED` | 재답변 업로드·서버 접수 최종 실패 | 제출 실패 화면으로 전환될 때 | 재답변 시도당 1회 |
| `REANSWER_GRADING_FAILED` | 재답변 채점 서버 실패·timeout | 채점 실패 화면으로 전환될 때 | 재답변 시도당 1회 |
| `LEARNING_RECORD_DELETE_FAILED` | 사용자가 확인한 전체 학습 기록 삭제 실패 | 삭제 실패 안내 상태로 전환될 때 | 삭제 요청당 1회 |

처리되지 않은 JavaScript/native 크래시와 React 렌더링 실패는 기존 자동 수집을 유지한다.

## 3. 수집하지 않을 오류

- 자동 재시도 또는 polling 도중의 개별 네트워크 실패
- 첫 채점 대기 실패처럼 사용자가 아직 정상 복구할 수 있는 중간 상태
- 사용자의 마이크 권한 거부, 닫기, 취소와 다시 녹음
- 화면 이탈, 앱 background 전환, unmount와 새 요청으로 인한 abort/cancelled
- 성공한 작업 뒤 임시 오디오 파일 삭제 실패
- 화면 이탈 과정의 녹음 정리와 audio mode 복원 실패
- 기존 성공 데이터를 유지할 수 있는 background·focus 재조회 실패
- 복구 가능한 표 셀 누락과 개발용 계약 경고
- 유효하지 않거나 현재 화면과 관계없는 WebView 메시지의 정상 무시
- Sentry·Clarity 같은 분석 도구 자체의 초기화 실패
- 성능 trace, 프로파일링과 세션 리플레이

## 4. 이벤트에 넣을 수 있는 데이터

다음처럼 사전에 정한 낮은 cardinality 값만 허용한다.

- 안정된 `error_code`
- `feature`, `operation`, `stage`, `reason`
- `retryable`, 제한된 attempt 정보
- HTTP status와 서버의 안정된 error code
- 필요할 때만 question number, part number, retry count와 cue kind
- 자동으로 붙는 app release, environment와 platform

표시 message와 grouping은 사용자·서버 원문이 아니라 안정된 오류 코드를 기준으로 한다.

## 5. 이벤트에 넣으면 안 되는 데이터

- exam ID, installation ID, 계정·사용자 식별자
- access token, refresh token, Authorization header와 cookie
- 전체 URL, query string, request body
- 서버 오류 message, response body와 result 원문
- 오디오 URI, 로컬 파일 경로와 녹음 내용
- 문제, 표, 답변과 피드백 본문
- Sentry user context 또는 개인을 다시 식별할 수 있는 임의 값

자동으로 붙은 breadcrumb, context, exception과 extra도 전송 직전 같은 기준으로 필터링한다.

## 6. 전송 및 중복 규칙

- 수동 이벤트는 오류 상태를 그리는 컴포넌트가 아니라 실패를 확정하는 상태 전환 지점에서
  생성한다.
- 한 작업 안에서 callback, effect 또는 렌더링이 반복돼도 같은 오류는 한 건만 생성한다.
- 여러 문제의 답변 제출이 각각 실패하면 답변 시도별 한 건씩 생성할 수 있다.
- 명시적 사용자 재시도는 새 시도이므로 다시 실패하면 새 이벤트 한 건을 생성한다.
- WebView의 `onError`, HTTP 오류와 오류 렌더 callback이 연달아 와도 한 문서 로드에서는 한
  건만 생성한다.
- 여러 request가 하나의 종합 피드백 재생성 작업을 공유하면 작업 기준으로 한 건만 생성한다.

## 7. 기존 동작 보존

- 오류 보고 추가로 사용자 문구를 바꾸지 않는다.
- timeout과 자동·수동 재시도 횟수를 바꾸지 않는다.
- 성공, 실패, 취소와 화면 이동 순서를 바꾸지 않는다.
- 오류 보고가 꺼져 있거나 자체 실패해도 기존 복구 UI와 사용자 행동은 그대로 동작한다.

## 8. 완료 조건

1. 위 15개 수동 오류의 확정 실패가 올바른 코드로 모두 보고된다.
2. 자동 복구, 권한 거부, 취소, 이탈, background와 abort에서 수동 이벤트가 0건이다.
3. 동일 시도의 같은 오류는 중복 callback과 재렌더링 후에도 1건을 넘지 않는다.
4. 두 번의 명시적 사용자 시도가 각각 실패하면 시도별 한 건씩 보고된다.
5. 합성 개인정보를 넣은 검증에서 금지 데이터 노출이 0건이다.
6. Sentry 활성·비활성 및 전송 실패 상황에서 기존 사용자 흐름이 동일하다.

## 9. 범위 밖

- Sentry 조직의 보존 기간, 멤버 권한, alert와 대시보드 구성
- 서버와 웹 애플리케이션 내부 오류 수집
- 사용자 안내 문구와 복구 UX 개편
- 새 분석 SDK, 성능 추적 또는 세션 리플레이 도입
