# 학습 기능 반영·검증 체크리스트

2026-10-13 기준. 제품 기능과 파일 설명은 [인수인계](answer-learning-handoff.md), 서버 규격은 [API 계약](api/answer-learning.md)을 먼저 본다.

## 전달 상태

| 항목          | 상태                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 프론트        | 기존 `feat/answer-learning`에 실제 앱 학습 탭/기능/후속 수정 전달. 최신 원격 main `ab1c708` 기준 통합                          |
| 백엔드        | [PR #36](https://github.com/Too-Much-I/app-back-end-learning-core/pull/36) develop 병합, merge `39c2b7b`, 테스트 ECS 배포 완료 |
| 테스트 데이터 | 200카드·360문항·1,000답안·2,756미디어 참조·Part 2~5 체크리스트 320문항 반영 완료                                               |
| 테스트 채점   | 학습 전용 Lambda·S3 권한·ECS 설정 준비 및 배포 완료. 프론트에는 모델 키/Lambda 주소 불필요                                     |
| 아이폰        | 기존 앱을 보존한 별도 개발 앱 설치, 실제 코드 로드·로그인 화면 확인. 사용자가 정상 동작 확인                                   |
| 운영 환경     | 운영 학습 백엔드/데이터/권한/채점 설정과 운영 EAS 값은 별도 출시 절차. 테스트 배포를 운영 배포로 간주하지 않음                 |

백엔드 배포 증거: [자동 배포 run 38354317720](https://github.com/Too-Much-I/app-back-end-learning-core/actions/runs/38354317720). 테스트 ECS revision 27, 실행 이미지와 merge commit 일치, 학습 API 10개 등록·기존 API 28개 경로 보존을 배포 작업에서 확인했다. 이 프론트 전달 작업은 AWS·Firebase·운영 DB 설정을 변경하지 않는다.

## 프론트 담당자가 할 일

1. 브랜치를 받아 diff를 리뷰한다. 진입점이나 로그인 화면을 샘플 코드로 교체하지 않는다.
2. 기존 Firebase 설정을 사용하고, development/preview에는 Identity/Core 테스트 주소를 함께 설정한다. 인증 UI 프리뷰·샘플 플래그는 끈다.
3. 아래 자동 검사를 실행한다. 네이티브 폴더를 수동 수정했다면 보존한 후 STT/Scene 플러그인을 prebuild에 반영한다.
4. `main`으로 리뷰·머지한 뒤 새 iOS/Android 네이티브 빌드를 만든다. 이 브랜치 전달 자체는 main 머지나 스토어 배포를 수행하지 않는다.
5. 아래 수용 시나리오를 확인하고 운영 환경 준비가 끝나면 production EAS 설정으로 배포한다. 테스트 주소를 production에 복사하지 않는다.

아이폰 테스트 앱의 개인 개발 서명·bundle ID 변경·Apple/푸시 entitlement 제외는 Git에 포함하지 않았다. 정식 앱 빌드는 기존 팀의 서명과 원래 기능을 사용한다. `eas.json`, 기존 Firebase 제공업체, 원래 앱 ID를 이번 학습 기능 때문에 바꿀 필요가 없다.

## 자동 검증

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:architecture
pnpm check:naming
pnpm test:learning
node --test scripts/test-ios-scene.cjs
```

학습과 Scene 검사는 PR CI에도 추가했다. 학습 테스트는 API 형식, 샘플 미디어 해시, 단어 매칭·재발화, 인식/재생 이벤트 경합, 업로드 재시도·중복 제출 등을 검증한다. 모의 응답을 사용하므로 실제 모델 채점 정확도를 검증하지 않는다.

백엔드의 `LearningImportedContentTest`가 만든 전체 콘텐츠 DTO를 받으면 프론트의 실제 Zod 스키마로 검사할 수 있다:

```sh
node scripts/validate-learning-contract.cjs /absolute/path/answer-learning-contract.json
```

기대 결과: catalogs 13, details 520, answers 1000, contentVersions 1. 입력에는 전체 비공개 콘텐츠가 들어 있으므로 공개 Git에 넣지 않는다. 검사는 네트워크 요청이나 원문/서명 URL 출력 없이 수행한다.

### 이번 전달 검증 기록

최종 실행 결과는 아래에 기록한다. 이전 실기기 확인과 자동/번들 검증은 서로 대체하지 않는다.

- iOS 시뮬레이터: 일반 앱 네이티브 빌드·실제 카카오 로그인 확인.
- iPhone 15 Pro: 일반 앱 코드의 별도 개발 서명 빌드 설치·로그인 화면 확인, 사용자 정상 사용 확인.
- 아직 별도 수용 확인이 필요한 범위: Android 실기기, 정식 서명의 Apple 로그인/푸시, 계정 병합·삭제와 동시 채점, 운영 서버, 모든 Part/등급의 실제 음성 채점 품질.
- 자동 검사: frozen lockfile 설치, 포맷, lint, TypeScript, architecture 차단 규칙, naming 통과. 학습 68개 + iOS Scene 3개 실패 0. architecture 참고 경고는 차단 오류와 구분한다.
- 실제 백엔드 DTO → 프론트 계약 검사: 목록 13개·상세 520개·답안 1,000개·콘텐츠 버전 1개 일치.
- 일반 앱 iOS/Android Metro·Hermes 번들 export 성공. 이는 Android 네이티브 빌드/실기기 검증을 대신하지 않는다.

## 최소 수용 시나리오

| 시나리오    | 확인할 결과                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------- |
| 기존 기능   | 로그인·홈·모의고사·챌린지·피드백·마이페이지 동작, 기존 모의고사 종료 안내 유지                 |
| 콘텐츠      | Part 1~5 목록, IM/IH/AL, 사진/표/뜻, 모범 음성. 서버 데이터이며 샘플 표기가 없어야 함          |
| Part 1      | 듣기 → 보면서 읽기 → 녹음 비교 → 완료·재진입. 제출/채점 요청 없음                              |
| Part 2~5    | 전체/일부/전체 빈칸, 힌트, 70%·놓친 단어 재발화·직접 넘기기, 녹음/제출/결과                    |
| 세트        | Part 3 Q5~7, Part 4 Q8~10 순서·문항별 표 발췌·부분 완료 및 전체 완료 표시                      |
| 재조회/복귀 | 학습 중 데이터 재조회가 문장·단계·녹음을 초기화하지 않음. 화면을 떠나 재진입하면 처음부터 시작 |
| 실패        | 마이크/STT 권한 거절·네트워크 끊김·만료 URL·무음·미지원 채점·완료 저장 실패의 안내/재시도      |
| 계정        | 다른 계정에 이전 캐시가 노출되지 않음. 계정 병합 완료 후 기록 재조회. 테스트/운영 기록 분리    |
| 제출        | 같은 녹음 재시도는 같은 ID, 완료 결과 재조회. 앱의 대기 중단이 서버 작업 취소로 오해되지 않음  |

## 이번 후속 수정의 이유

- `auth-runtime.ts`: 비동기 계정 병합 완료 시 한 번 캐시를 갱신한다. 기존 로그인/토큰/소유권 계약은 유지한다.
- `LearningSessionScreen.tsx`: 최초 조회 후 문항·음성 타이밍·contentVersion을 고정한다. 재조회로 녹음 컴포넌트가 분리되던 문제를 방지한다.
- `plugins/with-ios-scene-lifecycle.js` + Swift 템플릿: iOS 27의 Scene 시작 요구를 지원하고 Firebase 초기화·Expo launch hook·OAuth URL 복귀를 보존한다. 예상 밖 템플릿은 조용히 잘못 고치지 않고 실패한다.
- `app.config.ts`: 기존 설정 본문을 그대로 두는 구성 함수에 STT/Scene 플러그인만 추가하고, 샘플 분기를 분리했다.
- 문서: 미배포/로컬 전용이라는 오래된 설명을 제거하고 기능·실제 앱 실행·환경 전환·서버 책임·검증 경계를 명시했다.

## 로컬 프록시 어댑터

`LEARNING_DEVICE_BACKEND=1 pnpm sample:learning --port 8112`는 로그인 없는 개발 껍데기에서 실제 학습 API 모듈만 로컬 프록시에 연결하는 이전 검증 경로다. 일반 앱/테스트 ECS 로그인에는 필요하지 않다.

프록시를 별도로 준비한 개발자만 `EXPO_PUBLIC_LEARNING_DEVICE_API_URL`과 프록시 발급 `EXPO_PUBLIC_LEARNING_DEVICE_SESSION`을 설정한다. 공개된 백엔드 JWT나 AWS/모델 키를 넣지 않는다. 어댑터는 `__DEV__`와 `/api/v1/learning/` 경로를 검사하며, 일반 Metro는 이를 선택하지 않는다. 이 모드에서는 화면에 실제 채점 테스트라고 표시하고 실제 제출이 발생할 수 있다. 플래그를 빼면 외부 호출 없는 고정 샘플 모드다.
