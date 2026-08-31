# 같은 그림 4장 · Mermaid 판

오늘의 정본은 `../diagrams/*.drawio`다. 이건 형식을 비교해 보기 위한 것으로,
GitHub·Notion·VS Code에서 그대로 렌더된다. 레이아웃을 손으로 잡을 수 없어
draw.io판보다 정보가 덜 들어간다.

---

## 1. 컨셉맵

왼쪽에서 오른쪽으로 한 번만 읽으면 끝난다. 각 칸의 위/아래 두 상자는 **같은 단계를 지나는
서로 다른 학습 루프**다 — 모양이 같아서 코드도 닮았고, 그래서 이름이 겹치는 문제가 생겼다.

### 1-1. 먼저 한 번만 — 앱을 쓸 수 있게 되기까지

```mermaid
graph LR
  L(["학습자"]) -->|무엇으로 식별되나| INS["설치 ID<br/>UUID · 기기마다 하나"]
  L -->|무엇에 동의했나| REQ["필수 동의<br/>개인정보 · 이용약관 (버전)"]
  INS -->|이 둘이 있어야 계정이 생긴다| G["게스트 계정"]
  REQ --> G
  OPT["선택 동의<br/>품질 검토 · 철회 가능"] -.함께 기록되지만 조건은 아니다.-> G
  G -->|토큰을 발급받는다| S["인증 세션<br/>access · refresh"]
  S --> N["로그인 화면이 없다 —<br/>필수 동의가 곧 가입이다.<br/>복구 실패 시 처음이 아니라<br/>실패한 작업 하나로 돌아간다"]
```

### 1-2. 여섯 단계 — 위는 모의고사, 아래는 10초 챌린지

```mermaid
graph LR
  subgraph S1["① 무엇을 풀지 정해진다"]
    A1["<b>응시 1회</b> examId<br/>파트 1~5 → 문항 N개"]
    B1["<b>오늘의 문장</b> n / N<br/>서버 KST 날짜 · attempt가 1시간 고정"]
  end
  subgraph S2["② 제한 시간 안에 말한다"]
    A2["<b>답변 녹음</b><br/>문항마다 정해진 답변 시간"]
    B2["<b>10초 녹음</b><br/>들어보고 다시 녹음할 수 있다"]
  end
  subgraph S3["③ 올리고 접수시킨다"]
    A3["<b>답변 제출</b><br/>presigned PUT → 완료 통지"]
    B3["<b>제출</b><br/>녹음 1건 = 멱등 키 1개"]
  end
  subgraph S4["④ 서버가 판단한다"]
    A4["<b>채점</b><br/>파트 단위로 순차 진행"]
    B4["<b>AI 채점</b><br/>전사 → 첨삭 → 한마디"]
  end
  subgraph S5["⑤ 읽을 수 있는 형태로"]
    A5["<b>종합·문제별 피드백</b><br/>화면을 그리는 건 웹이다"]
    B5["<b>결과</b><br/>참고 답안 먼저, AI 첨삭이 덮는다"]
  end
  subgraph S6["⑥ 다시 한다"]
    A6["<b>재답변</b> retryCount"]
    B6["<b>한 문장 더</b>"]
  end

  A1 --> A2 --> A3 --> A4 --> A5 --> A6
  B1 --> B2 --> B3 --> B4 --> B5 --> B6
  A6 -.③으로 되돌아온다.-> A3
  B6 -.①로 되돌아온다.-> B1
```

### 1-3. 두 줄을 세로로 비교하면

| 단계 | | 무엇이 같고 다른가 |
|---|---|---|
| ① | **다르다** | 시험은 examId 하나로, 챌린지는 날짜 하나로 묶인다. 둘 다 앱이 만들지 않는다 |
| ② | **같다** | 녹음은 훅 하나(`use-timed-audio-recorder`)가 담당한다. 어댑터만 다르다 |
| ③ | **같다** | 업로드 경로가 같다. 챌린지가 시험 쪽 모듈을 그대로 가져다 쓴다 |
| ④ | **다르다** | 시험은 파트별 진행률이 보이고, 챌린지는 되거나 안 되거나뿐이다 |
| ⑤ | **다르다** | 시험 피드백은 웹이, 챌린지 결과는 앱이 그린다. 같은 "첨삭"을 두 번 구현했다 |
| ⑥ | **같다** | 되돌아오는 길이 있다. 시험은 ③으로, 챌린지는 ①로 |

### 1-4. 여섯 단계 전부에 걸리는 것

| | 내용 |
|---|---|
| 신원과 토큰 | 모든 요청에 세션이 실린다. 만료되면 한 번만 재발급, 실패하면 게이트로 |
| 시간의 정본 | 언제나 서버 — 챌린지 날짜 · 제출 기한 · URL 만료. 앱은 자정을 계산하지 않는다 |
| 관측 | ②③④에서 **흐름을 막은 실패**만. ⚠ 챌린지 줄은 아직 이 표에 없다 |
| 화면 규율 | 토큰 한 벌 · rem 스케일(웹뷰까지) · 세로 전용(Part 4 표만 예외) |

## 2. 아키텍처

```mermaid
graph TB
  subgraph L0["① 앱 진입"]
    IDX["index.ts<br/>관측 초기화"] --> APP["App.tsx<br/>Provider 4겹 + 폰트·rem 게이트"] --> RN["RootNavigator<br/>인증 상태가 스택을 고른다"]
    RN --> TAB["MainTabNavigator"] --> MS["MockExamStackNavigator"]
  end
  subgraph L1["② 화면 src/screens"]
    SH["Home"]; SE["mock-exam 6화면"]; SF["Feedback (WebView)<br/>+ ExamHistory 983줄"]; SR["Reanswer"]; SC["10초 챌린지 2화면"]
  end
  subgraph L2["③ 화면 상태"]
    HE["use-exam-session-controller<br/>+ exam-session-store (zustand)"]; HU["challenge-ui / reanswer-ui<br/>상태 합성"]
  end
  subgraph L3["④ 기능 src/features"]
    FA["auth<br/>controller 싱글턴 821줄"]; FE["exam<br/>api11·map7·hook6"]; FC["challenge<br/>api6·hook5"]; FD["audio<br/>시간제한 녹음"]
  end
  subgraph L4["⑤ 공용 src/lib"]
    LA["api client·transport"]; LO["sentry·amplitude·clarity"]; LT["theme tokens·rem"]
  end
  subgraph L5["⑥ 외부"]
    XI["Identity API"]; XL["Learning API"]; XS["S3 presigned"]; XW["웹 서비스"]; XO["Sentry·Amplitude·Clarity"]
  end

  RN -.인증 게이트.-> SH
  SE --> HE --> FE
  SC --> HU --> FC
  SF --> FE
  FE --> FD
  FC --> FD
  FC -->|"upload-answer-audio 직접 참조 ⚠"| FE
  FE --> LA
  FC --> LA
  LA -->|"토큰을 묻는다 (유일한 역방향) ⚠"| FA
  LA --> XL
  FA --> XI
  FE --> XS
  SF <-->|"브리지: 토큰을 넘기지 않는다"| XW
  LO --> XO
```

## 3. Feature map

```mermaid
graph TB
  AU["<b>auth</b><br/>api5 · controller 821줄<br/>SecureStore · installation-id<br/>화면: Consent · AuthRecovery"]
  CO["<b>consent</b><br/>필수·선택 동의 로컬 기록<br/>null(미선택) ≠ false(거부)"]
  EX["<b>exam</b><br/>api11 · mapper7 · hook6<br/>파트 메타·서두·큐·오디오<br/>웹뷰 계약 6모듈<br/>화면: mock-exam6 · Feedback · Reanswer"]
  CH["<b>challenge</b><br/>api6 · mapper 1파일에 6개 ⚠<br/>hook5 · 오류코드표<br/>dev-mock + __DEV__ 4곳 ⚠<br/>화면: 문제 · 결과"]
  AD["<b>audio</b><br/>use-timed-audio-recorder 566줄<br/>세션·권한·파일<br/>화면 없음 — 두 도메인이 감싸 쓴다"]
  OR["<b>orientation</b><br/>센서 자세 감지 · 세로 전용 안내"]
  DI["<b>diagnostics</b><br/>Sentry 스크러빙 검증 카탈로그"]

  EX --> AD
  CH --> AD
  CH -.->|"업로드 경로를 빌려 쓴다 ⚠"| EX
  AU --> CO
  EX -->|모든 인증 요청| AU
```

## 4. IA

```mermaid
graph LR
  R["RootNavigator"]
  R -.동의 필요.-> C["Consent<br/>제스처 잠금"] --> CW["SettingsWebView<br/>약관·개인정보"]
  R -.복구 가능한 실패.-> AR["AuthRecovery"]
  R -->|인증 완료| T["MainTabs"]

  T --> H["① 홈"]
  T --> M["② 모의고사"]
  T --> F["③ 피드백 (WebView 호스트)"]

  H --> SET["설정"] --> SW["SettingsWebView"]
  H --> NO["알림 (목 데이터)"]
  H -->|"배너 · 문장 1번 고정 ⚠"| TC["10초 챌린지 문제<br/>제스처 잠금"]
  TC -->|제출 직후 replace| TR["10초 챌린지 결과"]
  TR -.한 문장 더.-> TC

  M --> M1["MockExamReady"] --> M2["ExamPartGuide"] --> M3["MicrophoneTest"] --> M4["SoundTest"] --> M5["ExamSession<br/>탭바 숨김·뒤로가기 보호"] --> M6["GradingWait<br/>제스처 잠금"]
  M6 -->|채점 완료| F

  F -->|파라미터 없음| FH["ExamHistoryScreen<br/>라우트 미등록 ⚠"]
  F -->|examId| FO["웹 /app-exam-screen"]
  F -->|+questionNumber| FQ["웹 /app-question-feedback"]
  FQ -->|REANSWER_REQUESTED| RA["Reanswer<br/>제스처 잠금"]
  RA -.제출 후.-> FQ
```
