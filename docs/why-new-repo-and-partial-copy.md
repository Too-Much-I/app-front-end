# 왜 새 레포로 시작했고, 왜 일부 파일만 가져왔는가

> **업데이트**: 아래 "왜 웹뷰인가" 섹션의 결정은 이후 뒤집혔다. Capacitor+WebView 대신 Expo(React Native)로 전환한 이유는 [why-expo-react-native.md](why-expo-react-native.md) 참고. 이 문서의 나머지 부분(새 레포로 시작한 이유, API 레이어 재사용 등)은 여전히 유효하다.

## 왜 웹뷰인가

`web-front-end`(토선생 웹 PoC)는 홍보/PR 목적으로 열어둔 것이고, 실제 서비스로서의 시험 진행 경험은 앱(Android/iOS)에서 자리잡을 예정이다. 새로 네이티브 코드를 처음부터 짜는 대신, 기존 웹 프론트엔드에서 검증된 화면/로직을 재사용할 수 있는 웹뷰 앱으로 가기로 했다.

두 방식 중 **Capacitor로 정적 빌드 결과물을 네이티브 셸에 번들링하는 방식**을 선택했다. 배포된 URL을 그냥 로드하는 방식(순수 WebView 래퍼)은 구현은 제일 쉽지만 애플 심사 가이드라인 4.2("Minimum Functionality")에 걸려 반려될 위험이 있어 제외했다.

마이크 녹음(`MediaRecorder`/Web Audio API)은 WebView 컨텍스트에서도 동작은 하지만, 녹음 도중 앱이 백그라운드로 전환되거나 메모리 압박을 받으면 WebView의 JS 컨텍스트가 일시정지/종료될 수 있어 안정성이 떨어진다. 그래서 녹음 기능만 Capacitor 커스텀 네이티브 플러그인(iOS `AVAudioRecorder`, Android 네이티브 `MediaRecorder`)으로 재구현하기로 했다. 화면 UI/네비게이션은 그대로 웹뷰(React)에 두고, 녹음 시작/중지 호출만 플러그인을 거치는 식이라 나머지 코드는 바뀌지 않는다.

플러그인에는 네이티브 구현과 별개로 웹 폴백(`web.ts`)도 함께 구현한다 — 기존 `MediaRecorder`/`getUserMedia` 코드를 그 안으로 그대로 이식해두면, 멘토 테스트용으로 웹에 별도 배포하는 버전에서도 같은 `startRecording()`/`stopRecording()` API 호출로 동일하게 동작한다(Capacitor가 실행 환경에 따라 네이티브/웹 구현을 자동으로 라우팅). 즉 웹 배포판을 위해 앱 코드를 따로 마이그레이션할 필요는 없다.

## 왜 Next.js가 아니라 Vite + React로 시작했는가

이 앱은 API 라우트나 SSR 같은 서버 기능이 필요 없는 순수 클라이언트 앱이다. Next.js를 쓰려면 `output: "export"`(정적 export)로 억지로 맞춰야 하고, 그 과정에서 이미지 최적화 등 일부 기능을 포기해야 한다. Capacitor는 애초에 정적 파일 뭉치를 기대하는데 Vite의 기본 빌드 결과물이 정확히 그 모양이라 마찰이 적다. 라우팅은 내장되어 있지 않아 `react-router-dom`을 별도로 추가했다.

## 왜 워크스페이스 공유 대신 "일부 파일 복사"인가

`web-front-end`를 실제 pnpm 워크스페이스로 바꿔서 API 레이어를 패키지로 공유하는 방법도 검토했지만, 지금 단계에서는 그 전환 비용이 "복사해오고 필요할 때 수동으로 포팅"하는 비용보다 크다고 판단해 후자를 택했다.

**트레이드오프**: 원본 레포에서 이 로직에 버그 수정이나 튜닝이 생기면 이 레포에도 수동으로 반영해야 한다 (자동 동기화 없음). 두 앱이 동시에 라이브 상태가 되면 이 부분을 주기적으로 확인해야 한다.

## 무엇을 가져왔고, 무엇을 안 가져왔는가

디자인 자체가 앱 전용으로 크게 바뀔 예정이라 **UI 컴포넌트 트리는 하나도 가져오지 않았다** (시험 진행 상태 머신, 튜토리얼/동의/마이크테스트 화면 등은 새로 그릴 것). 대신 이미 실사용 검증과 버그 수정을 거친 **API 통신 레이어**만 가져왔다 — `web-front-end`의 `Raw* → mapper → domain` 타입 변환 패턴을 그대로 유지한다.

### 코드 (의존성 그래프까지 확인 후 복사)

- `src/types/api.ts`, `src/types/exam.ts` — `ApiEnvelope`, `Raw*` 타입, 도메인 타입
- `src/lib/api/client.ts` — `apiFetch` 래퍼
- `src/features/exam/part-meta.ts` — `map-exam-session.ts`가 참조하는 파트 타이밍 상수 (처음엔 누락됐다가 나중에 추가됨)
- `src/features/exam/map-exam-session.ts`, `map-exam-grading-result.ts`, `map-exam-question-feedback.ts`
- `src/features/exam/use-grading-progress.ts`, `use-answer-recorder.ts`
- `src/features/exam/api/*.ts` (세션 생성/응답 업로드/채점 상태·결과 조회 등 7개 엔드포인트 함수)

### 문서 (코드만 가져오면 "왜 이렇게 짜여있는지"를 잃어버리므로 같이 복사)

- `docs/exam-session-duplicate-request-fix.md`
- `docs/mic-test-voice-verification.md`
- `docs/answer-audio-player-duration-fix.md`

### 자산 (마케팅 랜딩페이지 전용은 제외)

- `public/mascots/*` 전체 (26개) — 시험 진행 중 여러 화면에서 쓰이는 마스코트
- `public/assets/audio/*` 전체 (13개) — 파트 안내, 준비/응답 시작 큐, 사운드 체크음
- `public/mic-icon.png`, `public/logo.png` (시험 헤더에서 사용)
- **제외**: 히어로 영상(`hero/`, `video/`), OG 이미지, Next.js 기본 SVG 아이콘 — 마케팅 랜딩페이지에서만 쓰이거나 프레임워크 보일러플레이트라 앱에는 불필요

## 마이그레이션 중 실제로 고친 것

- `src/lib/api/client.ts`: `process.env.NEXT_PUBLIC_API_BASE_URL` → `import.meta.env.VITE_API_BASE_URL`. Vite는 `process.env`를 폴리필하지 않고, `VITE_` 접두사 붙은 변수만 클라이언트에 노출한다.
- `tsconfig.app.json`의 `erasableSyntaxOnly`를 껐다. 원본 코드가 생성자 파라미터 프로퍼티(예: `constructor(public status: number, ...)`) 문법을 쓰는데, Vite 스캐폴드 기본 tsconfig가 이를 막고 있었다. 원본 코드를 변형 없이 그대로 유지해야 향후 수동 포팅이 diff 없이 깔끔하므로, 클래스를 고치는 대신 이 옵션을 껐다.
- `vite.config.ts` / `tsconfig.app.json`에 `@/*` → `./src/*` 경로 별칭을 추가해 원본 레포와 동일한 import 경로를 유지했다.
