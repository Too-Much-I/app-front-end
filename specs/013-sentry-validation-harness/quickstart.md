# Quickstart: Sentry 오류 카탈로그 에뮬레이터 검증

## Safety boundary

- 사용자가 2026-08-12에 실제 Sentry 합성 이벤트 15건 전송을 승인했다.
- validation mode에서만 실행하고 environment/tag로 일반 운영 이벤트와 분리한다.
- 실제 API, 계정, 시험, 답변, 오디오 또는 삭제 동작을 사용하지 않는다.
- 같은 검증 run에서 전체 전송은 한 번만 실행한다.

## Prerequisites

- Android SDK의 `Pixel_8` AVD
- `EXPO_PUBLIC_ENABLE_SENTRY=true`
- validation mode를 명시적으로 활성화한 development build
- Sentry project `tmi-wh/tosunsaeng-app` 수신 결과를 읽을 권한

secret 값은 명령 인자, source, log 또는 결과 문서에 출력하지 않는다.

## Workspace checks

```sh
CI=true pnpm lint
CI=true pnpm exec tsc --noEmit
git diff --check
CI=true pnpm exec expo export --platform all --output-dir /tmp/app-front-end-sentry-validation-dist
```

추가 source audit:

- fixture key가 15개이며 `OperationalErrorCode`와 동일한지 확인한다.
- validation root가 `__DEV__`와 explicit flag 두 조건으로 제한되는지 확인한다.
- 일반 report call site와 message/fingerprint가 바뀌지 않았는지 확인한다.
- fixture/receipt에 forbidden field가 없는지 확인한다.

## Emulator run

1. `Pixel_8` AVD를 시작하고 boot completion을 기다린다.
2. validation mode를 활성화해 Android development build를 실행한다.
3. 화면에서 Sentry enabled와 `synthetic-validation` 표시를 확인한다.
4. 로컬 preview를 실행해 15/15와 안전한 payload를 확인한다. 이 단계는 외부 이벤트를 보내지 않는다.
5. UTC 시작 시간을 기록한다.
6. “15개 Sentry 전송”을 정확히 한 번 누른다.
7. code별 event ID 15개, captured 15/15와 flush success를 확인한다.
8. 화면을 캡처하거나 event ID 목록을 민감정보 없이 기록한다.

## Sentry reception check

전송 시작 UTC 이후 time window에 다음 query를 적용한다.

```text
environment:synthetic-validation synthetic_validation:true
```

다음을 대조한다.

- 이번 window에서 이벤트 15건
- 아래 15개 code가 각각 한 건
- emulator의 event ID와 Sentry event ID 일치
- stable fingerprint grouping 유지
- forbidden field 0건

```text
AUTH_BOOTSTRAP_FAILED
EXAM_SESSION_CREATE_FAILED
EXAM_REQUIRED_AUDIO_FAILED
EXAM_PRELUDE_FAILED
ANSWER_RECORDING_FAILED
ANSWER_SUBMISSION_FAILED
EXAM_GRADING_FAILED
FEEDBACK_PAGE_LOAD_FAILED
FEEDBACK_DATA_LOAD_FAILED
FEEDBACK_HISTORY_LOAD_FAILED
SUMMARY_FEEDBACK_RETRY_FAILED
REANSWER_QUESTION_LOAD_FAILED
REANSWER_SUBMISSION_FAILED
REANSWER_GRADING_FAILED
LEARNING_RECORD_DELETE_FAILED
```

## Failure handling

- emulator가 안 뜨면 AVD 상태와 adb 연결부터 복구하며 전송 버튼은 누르지 않는다.
- event ID가 15개가 아니거나 flush가 실패하면 재전송하지 않고 누락 code를 먼저 기록한다.
- read API가 권한 부족이면 dashboard에서 같은 query/time window를 수동 확인한다.
- Sentry 수신이 지연되면 동일 event ID를 일정 시간 재조회하고 새 이벤트를 만들지 않는다.
- 검증 종료 후 validation mode를 끄고 일반 앱 root가 열리는지 확인한다.

## Completion record

- Workspace checks: `pnpm lint`, `pnpm exec tsc --noEmit`, `git diff --check` 통과.
- Native bundle: iOS/Android Expo export 통과.
- Emulator AVD/build: `Pixel_8` 부팅 및 Android debug build/install 통과. 첫 시도는 system JDK를
  찾지 못해 실패했고 Android Studio bundled JDK로 재실행해 성공했다.
- Local preview: `preview 15/15 · captured 0/15` 확인.
- Actual capture started: `2026-08-12T13:10:38.604Z`.
- Captured event IDs: emulator 집계에서 `captured 15/15` 확인. 화면에 표시된 개별 event ID도
  32자리 hex 형식임을 확인했다.
- Flush: `success` 확인.
- Privacy inspection: local preview에서 code/feature와 allowlisted tags/context만 표시되고 ID, URL,
  URI, path, token, body, raw message/result/cause가 없음을 확인했다. synthetic API cause는
  `httpStatus=503`, `serverCode=SYNTHETIC_VALIDATION`만 남았다.
- Sentry received 15/15: 사용자가 아래 query의 dashboard에서 합성 이벤트 15건 수신을 확인했다.
  `.env.local`의 업로드용 token으로 organization events와 project event API를 read-only 조회한
  자동 검증은 둘 다 HTTP 403 (`You do not have permission to perform this action.`)이어서,
  emulator의 code/event ID 및 local preview의 forbidden field 0건과 dashboard 수신 건수를 대조했다.

```text
environment:synthetic-validation synthetic_validation:true timestamp:>2026-08-12T13:10:38Z
```

- Validation mode disabled regression: source에서 `__DEV__`와 explicit flag 이중 gate를 확인했고,
  validation flag 없이 실행한 iOS/Android production export가 통과했다. 일반 navigation route는
  추가하지 않았다.
