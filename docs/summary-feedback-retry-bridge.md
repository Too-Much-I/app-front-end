# 종합 피드백 재생성 WebView 브리지

종합 피드백 필수 값이 일부 비어 있을 때 웹이 인증된 재생성 요청을 앱에 위임하는 계약이다.

- 앱은 app-owned polling 계약인 `summaryFeedbackRetryVersion: 2` capability를 문서 로드 전에 주입한다.
- 웹은 `SUMMARY_FEEDBACK_RETRY_REQUESTED`와 `requestId`, 현재 `examId`를 전송한다.
- 앱은 현재 열린 시험과 examId가 일치할 때만 기존 `POST /api/v1/exams/{examId}/grading/retry`를 호출한다.
- 같은 시험의 요청은 FeedbackScreen 생명주기 동안 하나의 작업을 공유해 API를 한 번만 호출한다.
- 접수 성공 뒤 앱이 3초 간격으로 summary를 인증 조회하고 3분 timeout을 관리한다.
- 앱은 `accepted`, `completed`, `failed` 이벤트를 `window.__nativeSummaryFeedbackRetryBridge.deliver(...)`로 돌려준다.
- `completed`에는 서버 원본 summary를 포함하며 웹은 이를 다시 완전성 검사한 뒤 화면 데이터로 교체한다.
- 웹 문서가 다시 열리면 같은 requestId를 재전송하고, 앱은 시험별 기존 작업의 현재 결과를 재생한다.
- 접수 실패 Sentry 이벤트에는 examId와 서버 오류 원문을 넣지 않는다.
- 공통 Sentry 필터가 URL, breadcrumb, context의 examId와 인증 정보를 한 번 더 제거한다.
