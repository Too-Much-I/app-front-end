# 학습 기능 실행·배포

2026-10-13 기준 · [기능 인수인계](answer-learning-handoff.md) · [API 명세](api/answer-learning.md)

## 1. 코드 실행

```sh
git fetch origin
git switch feat/answer-learning
git pull --ff-only origin feat/answer-learning
pnpm install --frozen-lockfile
pnpm ios
# Android: pnpm android
```

- 브랜치 전환 전: 기존 로컬 변경 보존
- Firebase: 기존 `config/firebase/GoogleService-Info.plist`·`google-services.json` 사용
- 파일 경로 지정: `GOOGLE_SERVICES_IOS`·`GOOGLE_SERVICES_ANDROID` 사용 가능
- 기존 native 폴더 사용 시: 수동 변경 보존 후 `pnpm exec expo prebuild --platform ios` 또는 `--platform android` 실행
- 필수 조건: STT 모듈을 포함한 새 네이티브 빌드, 마이크·음성 인식 권한

## 2. 서버 환경변수

로컬 `.env.local` 설정:

```dotenv
EXPO_PUBLIC_IDENTITY_API_BASE_URL=https://identity-test.to-teacher.com
EXPO_PUBLIC_LEARNING_API_BASE_URL=https://api-test.to-teacher.com
EXPO_PUBLIC_AUTH_UI_PREVIEW=false
EXPO_PUBLIC_FIREBASE_AUTH_VALIDATION=false
```

| 구분                 | 설정                                                          |
| -------------------- | ------------------------------------------------------------- |
| 로그인·회원·토큰     | `EXPO_PUBLIC_IDENTITY_API_BASE_URL`                           |
| 모의고사·피드백·학습 | `EXPO_PUBLIC_LEARNING_API_BASE_URL`                           |
| EAS 빌드             | development/preview/production별 동일 이름의 Environment 사용 |
| 로컬 주소 변경       | Metro 재시작(`pnpm start --clear`), 앱 재로드, 재로그인       |
| 운영 주소 변경       | EAS production에 운영 주소 2개 설정, 새 빌드·배포             |

- 로그인·학습 서버: 토큰 인증이 호환되는 환경으로 함께 설정
- 운영 주소: 기존 운영 앱·백엔드 설정 확인 후 지정, 현재 EAS production 값 미확인
- 주소 검증: 누락·형식·HTTPS 검사 적용, production의 테스트 주소 사용 차단 없음
- 테스트/운영: 계정·학습 기록 분리, 자동 데이터 이전 없음
- 일반 앱에서 제외할 값: `LEARNING_SAMPLE`, `LEARNING_DEVICE_BACKEND`, `EXPO_PUBLIC_LEARNING_DEVICE_SESSION`
- Git 제외: 실제 `.env.local`, Firebase 설정 파일, 개인 개발 서명

## 3. 현재 배포 상태

| 항목          | 상태                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| 프론트        | `feat/answer-learning`, main `ab1c708` 반영 완료                                                             |
| 백엔드        | [PR #36](https://github.com/Too-Much-I/app-back-end-learning-core/pull/36) develop 머지·테스트 ECS 배포 완료 |
| 테스트 콘텐츠 | 200카드·360문항·1,000답안, 체크리스트 320문항 반영 완료                                                      |
| 테스트 채점   | 학습 Lambda·S3 권한·ECS 설정 배포 완료                                                                       |
| 운영 환경     | 학습 백엔드·콘텐츠·권한·채점 설정 별도 적용 필요                                                             |

배포 이력: [백엔드 배포 결과](https://github.com/Too-Much-I/app-back-end-learning-core/actions/runs/38354317720)

## 4. 검증 결과

| 항목           | 결과                                           |
| -------------- | ---------------------------------------------- |
| 코드 검사      | 포맷·lint·타입·구조·명명 규칙 통과             |
| 자동 테스트    | 학습 68개·iOS Scene 3개 통과                   |
| 데이터 계약    | 목록 13개·상세 520개·답안 1,000개 일치         |
| 번들 생성      | 일반 앱·샘플의 iOS/Android 번들 생성 성공      |
| 샘플 분리      | 샘플 미디어 140개, 일반 앱 번들 포함 0개       |
| iOS 시뮬레이터 | 일반 앱 빌드·카카오 로그인 확인                |
| 아이폰         | 별도 개발 앱 설치·로그인 화면·사용자 동작 확인 |

**출시 전 추가 확인**

- 기존 로그인·홈·모의고사·챌린지·피드백·마이페이지
- Part 1 녹음 비교·완료, Part 2~5 녹음 제출·채점·완료
- Part 3·4 문항 이동·부분 완료, Part 4 표 발췌
- 권한 거절·통신 실패·무음·재시도·백그라운드 복귀
- 계정 변경·병합·삭제, 진행 중 채점과의 충돌
- Android 실기기, 정식 서명의 Apple 로그인·푸시, 운영 서버, 파트·등급별 채점 품질

아이폰 테스트용 별도 이름·bundle ID·Apple/푸시 제한: 로컬 설치본에만 적용. 정식 빌드의 기존 설정 유지.

## 5. 검사 명령

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm check:architecture
pnpm check:naming
pnpm test:learning
node --test scripts/test-ios-scene.cjs
```

전체 콘텐츠 응답 검사:

```sh
node scripts/validate-learning-contract.cjs /absolute/path/answer-learning-contract.json
```

- 입력: 백엔드 `LearningImportedContentTest`의 DTO 출력 파일
- 예상 결과: catalogs 13 / details 520 / answers 1000 / contentVersions 1
- 전체 콘텐츠 파일: 공개 Git 제외
- 자동 검사 범위: 모의 API 응답·코드 동작·형식 검증, 실제 채점 정확도 제외

## 6. 서버 없는 샘플 실행

```sh
pnpm sample:learning:ios
# Android: pnpm sample:learning:android
# 설치 후 Metro만 실행: pnpm sample:learning
```

- 자료: 파트별 2카드, 총 10카드·18문항·50답안
- 채점: 고정 예시 2/3 충족, 실제 녹음 분석·업로드 없음
- 완료 기록: 메모리 저장, 앱 재시작 시 초기화
- 샘플/일반 앱 전환: 별도 checkout 권장, 동일 checkout 사용 시 native 설정 재생성 필요

### 로컬 프록시 어댑터

- 이전 개발용 경로: `LEARNING_DEVICE_BACKEND=1 pnpm sample:learning --port 8112`
- 별도 프록시 준비 시에만 사용, 일반 앱·테스트 ECS 로그인에 불필요
- 설정: `EXPO_PUBLIC_LEARNING_DEVICE_API_URL`, 프록시 발급 `EXPO_PUBLIC_LEARNING_DEVICE_SESSION`
- 이 모드의 제출: 실제 업로드·채점 가능, 화면에 백엔드 테스트 표시

운영 빌드 상세: [기존 EAS 빌드 안내](eas-build-handoff.md)
