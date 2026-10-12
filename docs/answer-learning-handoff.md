# 답변 익히기 프론트 인수인계

## 먼저 알아둘 것

기준은 `origin/main`의 `3e17478`(2026-10-12)이고, 작업 브랜치는 `feat/answer-learning`이다.
기존 앱에 **학습 탭**을 추가했다. 로그인·홈·모의고사·피드백·마이페이지·푸시·오류 수집은 최신 main의 흐름을 유지한다.

**이 브랜치는 프론트 구현과 연동 계약이다. 아래 신규 API는 아직 백엔드에 배포되지 않았다.**
백엔드를 연결하기 전에는 학습 목록에 불러오기 실패/재시도 화면이 보인다. 실제 서버 결과처럼 보이는 더미 채점은 없다.
실제 문제은행·모범답안·사진·음성·개인 녹음·API 키는 커밋하지 않는다. 콘텐츠는 MongoDB, 미디어는 S3에 보관하고 백엔드가 제공한다.

1. 화면/파일 흐름: 이 문서
2. 백엔드 요청·응답·저장·오류 규칙: [API 계약](api/answer-learning.md)
3. 그대로 파싱 테스트할 수 있는 가상 응답: [JSON 예시](api/answer-learning-examples.json)
4. API 경계 테스트: `scripts/test-learning-api.cjs`

## 실행

```sh
git fetch origin
git switch --track origin/feat/answer-learning
pnpm install --frozen-lockfile
# 기존 앱의 Firebase 설정과 .env.local.example 기반 서버 환경설정을 준비
pnpm ios
# Android
pnpm android
```

기존 `EXPO_PUBLIC_LEARNING_API_BASE_URL`을 그대로 사용한다. 예: `https://learning-api.example.com`.
새 경로는 그 아래 `/api/v1/learning/...`이다. 기존 앱의 인증 토큰을 공용 API client가 붙인다.
별도 프리뷰 토큰, STT 키, OpenAI 키, AWS 자격증명을 프론트 환경변수에 추가하지 않는다.

`expo-speech-recognition@57.1.0`과 권한 설정이 추가되어 **네이티브 재빌드가 필요**하다. Expo Go에서는 동작하지 않는다.
원래 앱의 bundle ID·Firebase·Sentry·푸시 config plugin은 유지한다. `LearningPreviewApp`/`production-entry`/임시 홈은 이 브랜치에 없다.

## 사용 흐름

- **목록:** Part 1~5, 전체/완료 필터, IM/IH/AL 선택. 내부 IM 값은 `IM3`. Part 1은 `common`으로 등급 공통이다.
  백엔드가 반환한 문항별 완료 정보를 합쳐 완료한 카드가 아래로 정렬된다. Part 3·4는 세 문항을 포함한 한 카드다.
- **듣기:** 문항 자료 + 문장별 음성 자동 재생. 단어 타임스탬프에 따라 박스가 강조된다. 다음을 누르면 다음 문장을 바로 재생하며 마지막은 따라 말하기로 넘어간다.
- **따라 말하기:** 전체 문장 → 일부 빈칸 → 전체 빈칸. Part 1에는 빈칸 단계가 없다. STT의 중간 결과를 단어에 즉시 반영하고, 빠진 단어만 다시 말할 수도 있다.
  누적 70% 이상을 인식하고 발화가 끝나면 성공 효과 후 자동 진행한다. 인식 실패 시에도 이전/다음으로 직접 이동할 수 있다.
- **힌트:** 첫 글자 → 전체 문장 → 다시 가리기. Part 2~5는 하단 공통 해석 보기에서 질문/현재 문장의 뜻을 확인한다.
- **실전:** 로컬 녹음 → 내 답변 듣기. Part 1은 모범 음성과 비교해서 듣기로 끝나며 업로드·채점하지 않는다.
  Part 2~5는 지원 문항일 때 답변 제출 → 업로드 → 채점 상태 조회 → 체크리스트 결과 → 홈/다시 녹음이다.
- **완료:** Part 1 비교 화면 진입, Part 2~5 채점 완료 시 서버에 완료 기록을 보낸다. 단어 인식 점수와 완료 여부를 같은 것으로 취급하지 않는다.
  중간 문장 위치·빈칸 단계는 서버/AsyncStorage에 저장하지 않는다. 다시 열면 처음부터 시작한다.
- **미지원/오류:** 아직 체크리스트가 없으면 준비 중 안내와 녹음·재생만 제공한다. 통신 실패/저장 실패/재생 실패에는 재시도 경로를 둔다.

실전 녹음은 세션 내 임시 파일이다. 화면을 떠나면 로컬 파일을 정리한다. 업로드된 파일의 보관/삭제는 백엔드 정책이다.
'대기 중단'은 프론트의 polling만 중단한다. 서버에서 이미 시작한 채점을 취소하지 않는다.

## 코드 위치

| 영역 | 위치 | 담당 |
| --- | --- | --- |
| 앱 연결 | `src/navigation/MainTabNavigator.tsx`, `LearningStackNavigator.tsx`, `types.ts` | 학습 탭/학습 세션 라우트. 세션에서만 하단 탭 숨김 |
| 목록 | `src/screens/learning/LearningHomeScreen.tsx`, `LearningUnitRow.tsx` | API 목록, 등급/필터, 완료 정렬 |
| 세션 | `src/screens/learning/LearningSessionScreen.tsx` | 상세 조회, 3단계, 녹음 파일 소유/정리, 완료 저장 |
| API | `src/features/learning/api/`, `learning-submission-api.ts` | 인증 요청, 응답 검증, S3 업로드, 완료 |
| 계약 | `learning-content-schema.ts`, `learning-submission.ts`, `learning-upload-schema.ts` | Zod 런타임 검증 |
| 매핑 | `map-learning-unit.ts`, `map-learning-detail.ts` | API 자료 → UI 모델 |
| 조회 캐시 | `learning-queries.ts` | React Query. 사용자 변경 시 기존 앱의 cache clear 적용 |
| 듣기 | `use-learning-listening.ts`, `use-learning-audio.ts`, `LearningListen.tsx` | 자동 재생·이동·중단·만료 음성 URL 갱신 |
| 말하기 | `use-learning-recognition.ts`, `learning-speech-match.ts`, `LearningShadow.tsx` | 기기 STT, 부분 재인식, 70%, 힌트·효과 |
| 실전/채점 | `LearningPractice.tsx`, `use-learning-submission.ts`, `LearningCheckResultCard.tsx` | 녹음, 제출 ID 재사용, 상태 polling, 결과 |
| Part 4 | `LearningSource.tsx`, `LearningTable.tsx`, `learning-table-layout.ts` | 질문별 표 발췌, 전체 표. 기존 시험 표 코드는 수정하지 않음 |

화면은 네트워크 raw 자료를 직접 다루지 않는다. 스키마 검증 → mapper → domain 모델 → 화면 순서다.
답변·문장·오디오·단어 타이밍은 같은 콘텐츠 버전으로 묶여야 한다. `contentVersion`이 바뀌면 이전 녹음을 새 답변 기준으로 채점하지 않는다.

## 기존 파일을 바꾼 범위

- `MainTabNavigator.tsx`: 학습 탭 1개와 세션의 탭 숨김 조건만 추가.
- `types.ts`: 학습 라우트 타입만 추가.
- `app.config.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`: STT 모듈·권한·온디바이스 강제 패치, 학습 검사 명령.
- `Text.tsx`, `Button.tsx`: 학습 navigator 안에서만 시스템 글꼴. 다른 화면은 원래 Jua와 버튼 동작 유지.
- `tokens.js`: 학습 색상 추가. 기존 토큰 값 유지.
- `AudioWaveform.tsx`: 학습용 variant 추가. 기존 시험 variant 유지.

## 프론트/백엔드 합류 순서

1. 백엔드가 [계약](api/answer-learning.md)의 목록·상세·미디어 주소 조회를 구현한다. JSON 예시는 실제 데이터로 바꾸되 스키마를 유지한다.
2. S3에 기존 사진·음성을 올리고, MongoDB 문항/답변에 **S3 key가 아닌 내부 media ID**를 연결한다. 백엔드는 ID를 권한 확인 후 S3 key로 해석한다.
3. Part 1 및 Part 2~5 듣기/따라 말하기를 확인한다. 실제 기기에서 권한·인식·백그라운드·음성 URL 만료를 확인한다.
4. 완료 저장과 목록의 완료 표시를 연결한다.
5. 제출/업로드 URL/업로드 확인/결과 조회를 구현하고, 백엔드 뒤에 STT + OpenAI Decisions Lambda를 연결한다.
6. 마지막으로 지원 체크리스트 문항만 capabilities에 활성화한다. 이 브랜치 자체는 Lambda, S3 버킷, MongoDB, 과금 API를 생성/호출하지 않는다.

## 검증

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm exec tsc --noEmit
pnpm check:architecture
pnpm check:naming
pnpm test:learning
# 네이티브 JS/asset 번들 확인. 네이티브 기기 빌드와는 다름.
EXPO_NO_TELEMETRY=1 pnpm exec expo export --platform ios --output-dir /tmp/answer-learning-ios
```

자동 테스트의 STT·업로드·채점 응답은 모의한 것이다. 실제 인식 정확도, 실제 S3/CORS/인증 및 MongoDB/Lambda 연동 성공을 뜻하지 않는다.
backend 구현 전에는 API 통합 테스트와 실제 계정의 앱 종단 검증이 남는다. 저장소의 사람 학습 기록/PR 리뷰 절차도 별도이며, 이 브랜치는 자동 머지하지 않는다.

### 이 브랜치에서 확인한 결과 (2026-10-12)

- frozen lockfile 설치, format:check, lint, TypeScript, naming 통과.
- architecture 차단 규칙 통과. 저장소의 검토용 의존성 경고 35건은 별도 검토 정보다.
- 학습 자동 테스트 **65건 통과**, 별도 단어 매칭/힌트 경계 검사 통과. 외부 모델 API 호출 없음.
- iOS Metro/Hermes JS 번들 export 성공. 이 checkout에는 Firebase 설정 파일이 없어 관련 경고가 출력되었다.
  따라서 이 결과를 서명된 네이티브 앱 빌드·실제 계정/서버 연동 검증으로 보지 않는다.
- 기존 원격 main을 다시 fetch/pull하여 `3e17478`이 최신임을 확인했다.
