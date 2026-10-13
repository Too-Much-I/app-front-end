# 학습 기능 프론트 인수인계

## 이 브랜치를 받으면 무엇이 달라지나

`app-front-end`의 **`feat/answer-learning`** 브랜치다. 기존 앱에 **학습 → 답변 익히기**를 추가했다. 별도 프리뷰 앱을 다시 이식하거나 화면을 새로 연결할 필요가 없다. 기존 로그인·홈·모의고사·피드백·마이페이지를 유지한다.

- 기준: 최신 원격 `main`의 `ab1c708`(2026-10-13 확인). main의 모의고사 종료 안내 수정도 feature 브랜치에 함께 반영했다.
- 실제 앱: 기존 인증으로 테스트 서버에 접속한다. 테스트 Learning Core는 [백엔드 PR #36](https://github.com/Too-Much-I/app-back-end-learning-core/pull/36)으로 배포됐다.
- 검증: iOS 시뮬레이터의 실제 카카오 로그인, 별도 아이폰 앱 설치·로그인 화면을 확인했고 사용자가 “잘 되는거 확인했어”라고 확인했다. Android 실기기·운영 서버·모든 오류 시나리오까지 검증했다는 뜻은 아니다.
- 전체 콘텐츠는 MongoDB, 사진·음성은 S3에 있다. 앱은 API로 받는다. 공개 저장소에는 요청받은 **Part별 2개 샘플 카드**만 포함했다.

**먼저 이 문서를 읽고, 출시 담당자는 [반영·검증 체크리스트](answer-learning-release.md), API를 수정하는 담당자는 [API 계약](api/answer-learning.md)과 [예시 응답](api/answer-learning-examples.json)을 읽으면 된다.**

## 사용자에게 제공되는 기능

| 화면/기능        | 현재 구현                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 학습 홈          | Part 1~5, 전체/완료 목록, IM·IH·AL 선택, 한 줄 제목, 아래로 당겨 새로고침, 맨 위로 이동                                           |
| 완료 표시        | 완료 카드의 색·배지를 구분하고 목록 아래로 이동. Part 3·4는 세 문항을 모두 완료해야 카드 완료                                     |
| 듣기             | 문제 자료를 위에, 현재 답변 문장을 아래에 표시. Robert 모범 음성, 문장 자동 재생, 이전/다음·일시정지, 단어 박스에 시간별 강조     |
| 따라 말하기      | 기기 내 영어 STT로 말한 단어를 표시. 놓친 단어만 다시 말할 수 있고 누적 70% 이상 인식 후 발화가 끝나면 성공 효과와 함께 자동 진행 |
| 인식이 어려울 때 | 인식 결과와 무관하게 직접 이전/다음 이동 가능. 지원하지 않는 기기나 권한 거절 시 안내                                             |
| 기억하며 말하기  | Part 2~5는 전체 문장 → 일부 빈칸 → 전체 빈칸. 힌트는 첫 글자 → 전체 문장 → 다시 가리기                                            |
| 해석             | Part 2~5 하단의 공통 해석 버튼으로 질문/현재 문장의 한글 뜻 확인. Part 1에는 없음                                                 |
| 실전 연습        | 준비·답변 시간, 녹음, 내 답변 재생, 다시 녹음. 문제 자료와 하단 조작 영역 분리                                                    |
| Part 1 마무리    | 내 녹음과 모범 음성을 번갈아 비교. 채점·녹음 업로드 없이 완료 저장                                                                |
| Part 2~5 마무리  | 답변 제출 → 음성 업로드 → 전사·채점 대기 → 체크리스트 결과. 마지막에 학습 홈/다시 녹음                                            |
| 결과             | 항목별 충족·미충족·판단 불확실, 충족 개수, 피드백, 전사문. 공식 토익스피킹 등급/발음 점수가 아님                                  |
| 재학습           | 중간 문장·빈칸 단계는 세션 안에서만 유지. 나갔다 들어오면 처음부터 시작. 완료 기록은 서버에 유지                                  |
| 약점 훈련        | 준비 중 표시, 진입 비활성                                                                                                         |

### 파트별 차이

| 파트             | 문제 자료                                   | 따라 말하기                        | 실전 종료              |
| ---------------- | ------------------------------------------- | ---------------------------------- | ---------------------- |
| 1 지문 읽기      | 전체 영어 지문                              | 보면서 읽기만. 빈칸/등급/해석 없음 | 내 녹음·모범 음성 비교 |
| 2 사진 묘사      | 흰 카드 안의 사진                           | 3단계, IM/IH/AL                    | 체크리스트 채점        |
| 3 질문에 답하기  | Q5·6·7의 현재 질문                          | 문항별 3단계                       | 문항별 체크리스트 채점 |
| 4 표 보고 답하기 | Q8·9·10 질문 + 필요한 표 발췌, 전체 표 보기 | 문항별 3단계                       | 문항별 체크리스트 채점 |
| 5 의견 말하기    | 의견 질문                                   | 3단계, IM/IH/AL                    | 체크리스트 채점        |

화면의 `IM`은 API에서 `IM3`, Part 1은 `common`이다. Part 1·2·5 카드는 1문항, Part 3·4 카드는 3문항이다.

## 실제 앱 실행 — 아이폰에서 확인한 기능

```sh
git fetch origin
git switch feat/answer-learning
git pull --ff-only origin feat/answer-learning
pnpm install --frozen-lockfile
# 아래 환경변수와 기존 Firebase 설정을 준비한 뒤 실행
pnpm ios
# Android 개발 환경이 준비된 경우
pnpm android
```

이미 다른 로컬 작업이 있으면 해당 작업을 보존한 뒤 브랜치를 전환한다. 원래 앱의 `index.ts`/`App.tsx`를 사용한다. `examples/learning-sample/index.tsx`를 실제 앱 진입점에 복사하지 않는다.

로컬 `.env.local`에는 기존 앱 설정과 함께 다음 두 주소를 넣는다. 기존 파일이 있으면 덮어쓰지 않는다.

```dotenv
EXPO_PUBLIC_IDENTITY_API_BASE_URL=https://identity-test.to-teacher.com
EXPO_PUBLIC_LEARNING_API_BASE_URL=https://api-test.to-teacher.com
EXPO_PUBLIC_AUTH_UI_PREVIEW=false
EXPO_PUBLIC_FIREBASE_AUTH_VALIDATION=false
```

- 기존 Firebase 파일: `config/firebase/GoogleService-Info.plist`, `config/firebase/google-services.json`. 또는 `GOOGLE_SERVICES_IOS`/`GOOGLE_SERVICES_ANDROID` 파일 경로. 파일과 실제 `.env.local`은 Git 제외다.
- 카카오 Provider ID와 Google/Apple 설정은 기존 앱의 [인증 설정 문서](firebase-auth-sdk-setup.md)를 따른다. **학습 추가 때문에 Firebase 앱/로그인 제공업체를 새로 등록할 필요는 없다.**
- 일반 앱에는 `LEARNING_SAMPLE`, `LEARNING_DEVICE_BACKEND`, `EXPO_PUBLIC_LEARNING_DEVICE_SESSION`을 설정하지 않는다. 로컬 샘플용 세션은 실제 로그인을 대체하지 않는다.
- `expo-speech-recognition`이 추가되어 **새 네이티브 빌드가 필요**하다. Expo Go나 기존 앱에 JS 업데이트만 적용하는 방식은 지원하지 않는다.
- 이미 생성한 `ios`/`android`가 있으면 네이티브 수동 변경을 먼저 보존하고 `pnpm exec expo prebuild --platform ios` 또는 `--platform android`로 설정을 동기화한다. 폴더를 지우는 `--clean`을 습관적으로 실행하지 않는다.
- 개인 서명으로 설치한 ‘토선생 테스트’의 별도 bundle ID·이름·Apple/푸시 제한은 **로컬 설치 산출물에만 적용**했다. 이 브랜치의 일반 빌드는 원래 앱 식별자·Apple 로그인·푸시 설정을 유지한다.

### 테스트 ↔ 운영 서버 전환

| 설정                                | 역할                                 | 테스트 값                              | 운영 빌드                             |
| ----------------------------------- | ------------------------------------ | -------------------------------------- | ------------------------------------- |
| `EXPO_PUBLIC_IDENTITY_API_BASE_URL` | 로그인·회원·토큰 API                 | `https://identity-test.to-teacher.com` | 운영 앱이 실제 사용하는 Identity 주소 |
| `EXPO_PUBLIC_LEARNING_API_BASE_URL` | 기존 모의고사·피드백 + 신규 학습 API | `https://api-test.to-teacher.com`      | 운영 Learning Core 주소               |

`eas.json`은 development/preview/production 프로필을 같은 이름의 EAS Environment와 연결한다. EAS의 해당 환경에 두 값을 명시하고 [기존 빌드 절차](eas-build-handoff.md)를 사용한다. production 프로필이라는 이름만으로 운영 주소가 자동 생성되지는 않는다. 현재 EAS production의 실제 값은 이번 작업에서 확인·변경하지 않았다.

- 로컬 변경: Metro 재시작(`pnpm start --clear`) 후 앱 재로드. 환경 변경 뒤에는 로그아웃·재로그인하여 이전 서버 토큰을 정리한다.
- 스토어 배포: production 환경변수를 확인한 뒤 `pnpm dlx eas-cli@latest build --profile production --platform ios` 또는 `--platform android`. 이 명령은 별도 배포 작업이다. 이미 설치된 앱의 주소는 환경변수만 수정해도 즉시 바뀌지 않는다.
- 두 서버는 토큰 issuer/audience가 호환되는 환경의 조합을 쓴다. 이름을 추측해 `identity-prod` 등으로 바꾸지 않는다. 테스트/운영 계정·기록은 자동 복사되지 않는다.
- 공통 fallback `EXPO_PUBLIC_API_BASE_URL`이 있어도 위 두 변수를 명시한다. 현재 주소 검증은 HTTPS/형식/누락 검사이며, production에 테스트 주소를 넣는 실수까지 차단하는 코드는 아니다.
- 앱에는 MongoDB URI·AWS 키·OpenAI 키·Lambda URL을 넣지 않는다. 운영 백엔드에도 학습 코드·콘텐츠·미디어·채점 설정이 배포돼 있어야 한다.

## 데이터와 API 흐름

```text
학습 탭 → 백엔드 목록/상세 → 문제·답변·사진·음성
따라 말하기 → 기기 내 STT (외부 채점 API 사용 안 함)
실전 제출 → 백엔드에 제출 생성 → 백엔드가 S3 업로드 URL 발급
         → 앱이 S3에 녹음 PUT → 백엔드에 submit
         → 서버/Lambda가 전사·체크리스트 채점 → 상태 조회 → 결과·완료 저장
```

신규 API는 기존 Learning Core host 아래 `/api/v1/learning/*` 10개다. 기존 Bearer/토큰 갱신/React Query를 재사용한다. 프론트는 사용자 ID나 채점 기준을 만들어 보내지 않는다. S3 PUT에는 앱 Bearer를 보내지 않는다.

완료는 문항·등급·콘텐츠 버전·사용자 기준으로 저장한다. 동일 녹음 재전송은 같은 제출 ID를 사용한다. 문제·문장·음성·타이밍·버전은 세션 진입 시점의 묶음을 유지하여 백그라운드 재조회가 연습/녹음을 초기화하지 않게 한다.

채점 불가·무음·실패·시간 초과를 가짜 성공 결과로 대체하지 않는다. ‘대기 중단’은 앱 조회만 멈추며 이미 시작한 서버 채점을 취소하지 않는다. 임시 녹음은 세션을 떠날 때 정리한다. 업로드된 파일의 보관/삭제는 서버 책임이다.

## 코드 위치와 기존 코드 수정 이유

신규 동작은 주로 `src/features/learning/`과 `src/screens/learning/`에 모았다.

| 위치                                                                                | 역할/기존 파일 수정 이유                                                           |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/navigation/MainTabNavigator.tsx`, `types.ts`                                   | 학습 탭/라우트 추가, 학습 세션에서만 하단 탭 숨김                                  |
| `src/navigation/LearningStackNavigator.tsx`                                         | 학습 홈/세션 연결, 학습 내부 글꼴 범위 지정                                        |
| `src/features/learning/api/`, `learning-submission-api.ts`                          | 목록/상세/미디어/완료/제출 요청                                                    |
| `learning-content-schema.ts`, `learning-submission.ts`, `learning-upload-schema.ts` | API 응답 런타임 검증. 화면은 raw DTO 대신 mapper의 domain 모델 사용                |
| `use-learning-listening.ts`, `use-learning-audio.ts`                                | 재생·이동·중단, 만료 URL 갱신                                                      |
| `use-learning-recognition.ts`, `learning-speech-match.ts`                           | STT 중간 결과, 누적/재발화 단어 매칭, 70% 통과                                     |
| `use-learning-submission.ts`                                                        | 업로드·제출·재시도·상태 조회                                                       |
| `LearningSessionScreen.tsx`                                                         | 문항·단계·버전 유지, 녹음 파일 수명, 완료 저장                                     |
| `LearningSource.tsx`, `LearningTable.tsx`                                           | 질문별 사진/표. 기존 모의고사 표 코드는 수정하지 않음                              |
| `src/components/ui/Text.tsx`, `Button.tsx`                                          | 학습 navigator 안에서만 시스템 글꼴. 기존 화면의 Jua/버튼 기본값 유지              |
| `src/theme/tokens.js`, `AudioWaveform.tsx`                                          | 학습 색상·파형 variant 추가. 기존 모의고사 variant 유지                            |
| `src/features/auth/auth-runtime.ts`                                                 | 계정 병합 완료 후 기존 조회 캐시 갱신 구독만 추가. 로그인/토큰 계약 유지           |
| `app.config.ts`, `plugins/with-ios-scene-lifecycle.js`, `app-scene-delegate.swift`  | STT 권한, iOS 27 Scene 실행 지원. Firebase 초기화·Expo·OAuth 복귀·앱 생명주기 보존 |
| `package.json`, pnpm lock/workspace, `patches/`                                     | STT 모듈, iOS 온디바이스 요청 강제 패치, 샘플/검사 명령                            |
| `metro.config.js`, `examples/learning-sample/`                                      | 샘플 명령에서만 진입점/API 교체. 일반 앱은 원래 resolver 사용                      |
| `.env.local.example`, `.github/workflows/ci.yml`                                    | 테스트 환경 예제 정합성, 학습·iOS Scene 회귀 검사 추가                             |

기존 `App.tsx`·`index.ts`, 인증 API client, `eas.json`, 기존 화면/모의고사 상태머신은 학습 구현으로 교체하지 않는다. 최신 main의 변경은 별도로 보존한다.

## 서버 없이 화면만 확인하는 샘플

```sh
pnpm sample:learning:ios
pnpm sample:learning:android
# 설치된 샘플 앱의 Metro만 실행
pnpm sample:learning
```

10카드(파트별 2개)·18문항·50답안·140미디어를 사용한다. Part 2~5 채점은 **고정 예시 2/3 충족**이며 화면에 샘플임을 표시한다. 외부 모델 호출·녹음 업로드·실제 계정 로그인은 하지 않고 완료 기록은 메모리만 사용한다. 일반 앱과 같은 학습 UI를 재사용한다.

샘플은 별도 앱 ID `com.toteacher.learning.sample`을 사용한다. 실기기는 `pnpm sample:learning:ios --device`로 설치할 수 있다. 샘플과 일반 앱을 같은 checkout에서 번갈아 네이티브 빌드하면 생성 설정을 다시 동기화해야 하므로 별도 checkout을 권장한다.

`LEARNING_DEVICE_BACKEND=1`은 이전 로컬 프록시 검증용 선택 기능이다. 이번 테스트 ECS/카카오 로그인 확인에는 사용하지 않았다. 자세한 경계는 [릴리스 문서](answer-learning-release.md#로컬-프록시-어댑터)를 따른다.

## 문제가 생겼을 때

| 증상                                      | 먼저 확인                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 로그인/모의고사는 되는데 학습 목록이 없음 | Learning Core 주소, 해당 서버의 학습 배포/활성화·데이터, API 응답. 로그인과 학습 서버가 서로 다른 환경인지 |
| 목록이 10개 카드이고 항상 같은 점수       | `sample:learning`/`LEARNING_SAMPLE`로 실행한 것인지                                                        |
| STT 모듈 없음/인식 불가                   | 새 native build 여부, 영어 온디바이스 모델/기기 지원, 마이크·음성 인식 권한. 수동 다음 이동 가능           |
| iOS 27 시작 시 빈 화면                    | Scene 플러그인이 적용된 새 네이티브 빌드인지                                                               |
| 사진/음성 재생 실패                       | 네트워크·S3 서명 URL 만료. 재시도 시 같은 media ID로 URL 갱신                                              |
| 답변 제출 준비 중                         | capabilities의 문항 지원 여부/채점 활성화 상태. 프론트에서 강제로 활성화하지 않음                          |
| 채점 지연/실패                            | 해당 submission 상태·error. 서버/Lambda 로그로 확인. 동일 녹음에 새 ID를 임의 생성하지 않음                |
| 휴대폰의 기존 시험 기록이 안 보임         | 정식 앱과 테스트 앱이 서로 다른 서버/DB인지. 테스트 앱은 운영 기록을 복사하지 않음                         |

테스트 명령과 전달 시점의 검증 결과는 [반영·검증 체크리스트](answer-learning-release.md)에 모았다.
