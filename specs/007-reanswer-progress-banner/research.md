# Phase 0 Research: 피드백 기록과 재답변 성장 요약

## Decision 1 — 이력 데이터의 권위 있는 출처

**Decision**: 현재 사용자의 완료 시험 이력과 재답변 이력을 각각 반환하는 서버 집계 계약을 사용한다. 앱은 응답을 `Raw* → mapper → domain` 경계로 정규화하고 두 탭의 요청 상태를 독립적으로 관리한다.

**Rationale**:

- 현재 앱은 채점 완료 직후 route로 전달된 `examId` 한 건만 알고 있으며 완료 시각, 과거 시험 목록과 전체 재답변 문제를 발견할 수 없다.
- 단일 문제 상세는 이미 알고 있는 `examId`, `questionNumber`, `retryCount`가 있어야 조회할 수 있어 이력 탐색용 계약이 아니다.
- 서버 집계는 앱 재설치·프로세스 종료·다른 기기에서도 동일한 결과를 제공하고, 채점 대기와 완료를 권위 있게 구분하며 N+1 요청을 피한다.
- 앱은 사용자 식별자를 URL이나 임의 헤더로 만들지 않는다. 이력 endpoint가 앱의 현재 요청 문맥에서 사용자 소유 데이터를 안전하게 반환할 수 있어야 구현을 시작한다.

**Alternatives considered**:

- 기기 로컬 JSON 인덱스: 현재부터 생성한 기록만 보존할 수 있지만 재설치·다른 기기·기존 기록을 놓치며, 상세 API fan-out과 pending 복구가 필요해 기각했다.
- 모든 시험의 11문항을 순회해 `totalRetryCount > 1`을 찾기: 최대 `11 × 시험 수` 요청이 필요하고 최신 회차의 완료 여부도 알 수 없어 기각했다.
- 한 개의 거대 endpoint로 두 탭을 함께 반환: 한 영역의 실패가 두 탭을 모두 막고 갱신 주기가 결합돼 기각했다.

## Decision 2 — 화면 소유권

**Decision**: 모의고사 기록과 다시 답변한 문제 탭은 React Native 화면으로 구현하고, 기존 전체/문제별 피드백은 WebView 상세 화면으로 유지한다.

**Rationale**:

- 현재 Feedback 탭은 `examId`가 있을 때 웹 상세 한 건만 열고, `examId`가 없으면 이력 대신 안내만 표시한다.
- 새 기록 허브는 네이티브 safe area, 큰 글자, 태블릿 너비, 공용 `Text`/`Pressable`, NativeWind와 theme token 규칙을 직접 지킬 수 있다.
- 기존 웹 상세는 파트 단계, 문제 선택, 회차 이동과 재답변 메시지 계약을 이미 제공하므로 다시 구현할 이유가 없다.

**Alternatives considered**:

- 모든 기록 UI를 웹 저장소에 구현하고 현재 WebView shell 유지: 앱 저장소에서 화면과 접근성을 완결할 수 없고 `examId` 없는 기록 URL 계약도 새로 필요해 기각했다.
- 전체/문제별 상세까지 네이티브로 재구현: 현재 WebView 계약을 중복하고 TMI-44 범위를 크게 넘으므로 기각했다.

## Decision 3 — Feedback 내비게이션 구조

**Decision**: Feedback 탭 아래에 `FeedbackHistory`와 `FeedbackWeb` 두 화면을 가진 전용 native stack을 둔다. 무파라미터 진입은 history root, 채점 완료·기록 선택·빈 재답변 CTA·재답변 완료는 typed detail params로 `FeedbackWeb`을 연다.

**Rationale**:

- history와 detail을 한 route의 optional params로 전환하면 params 수명, 탭 재선택, 상세에서 목록으로 돌아가기 책임이 한 컴포넌트에 섞인다.
- stack은 상세를 pop하면 기록으로 돌아가는 표준 흐름을 제공하고, 현재의 direct detail 진입도 명시적으로 보존할 수 있다.
- route params는 의미 기반 `initialSection: "part-feedback"`을 사용하고 URL 숫자는 WebView 경계에서만 해석한다.

**Alternatives considered**:

- 현재 `FeedbackScreen` 하나에서 route/local mode 전환: 변경 파일은 적지만 상세 진입 후 기록 복귀와 stale param 초기화가 취약해 기각했다.
- WebView 로드 후 `postMessage`로 단계 변경: 이미 URL deep-link가 있어 load timing race와 양쪽 메시지 변경만 추가하므로 기각했다.

## Decision 4 — 파트별 피드백 deep link

**Decision**: 사용자 요구의 `state=3`은 제품 의미상 “세 번째 파트별 피드백 단계”로 해석하고, 실제 웹 계약에는 `/app-exam-screen?examId=...&step=3`을 사용한다.

**Rationale**:

- 웹 page는 `step`만 읽어 1~3을 검증하며 `state`는 읽지 않는다.
- 웹의 세 번째 단계가 `PartFeedbackSection`이고 문제별 화면도 파트 피드백 복귀 시 `step=3`을 사용한다.
- 숫자 query를 native route 전반에 노출하지 않으면 웹 단계 수가 바뀌어도 URL builder만 수정하면 된다.

**Alternatives considered**:

- `state=3`을 그대로 query로 전달: 웹이 무시하고 첫 단계로 열어 기각했다.
- `step: 3` 숫자를 모든 native caller에 노출: 외부 웹 표현이 navigation domain으로 새어 나가 기각했다.

## Decision 5 — WebView 뒤로가기와 메시지

**Decision**: 기존 웹의 `FEEDBACK_NAVIGATION_STATE`, `QUESTION_FEEDBACK_NAVIGATION_STATE`, `FEEDBACK_GO_BACK` 계약을 native parser로 정식 연결하고 `REANSWER_REQUESTED`와 구분한다.

**Rationale**:

- 웹은 내부 단계/덱에서 먼저 뒤로갈 수 있는지 이미 알리지만 앱은 현재 이 메시지를 무시한다.
- 내부에서 뒤로갈 수 있으면 native pop을 막고 WebView에 `FEEDBACK_GO_BACK`을 보낸다. 첫 단계에서는 stack pop을 허용해 기록 허브로 돌아간다.
- 지원하지 않는 메시지, malformed JSON과 현재 시험이 다른 재답변 요청은 기존처럼 무시한다.

**Alternatives considered**:

- native back은 항상 stack pop: 웹의 2·3단계에서 기록으로 바로 빠져 기존 단계 경험을 깨므로 기각했다.
- 웹 브라우저 history만 검사: 회차 이동은 `replaceState`이고 내부 단계는 React state라 신뢰할 수 없어 기각했다.

## Decision 6 — 이력 요청 분리와 상태 관리

**Decision**: `useExamHistory`와 `useReanswerHistory`가 각 endpoint의 `idle/loading/ready/error`를 독립적으로 소유하고 AbortSignal 및 명시적 retry를 제공한다. 새 전역 store나 QueryClient는 추가하지 않는다.

**Rationale**:

- 한 탭의 실패가 다른 탭을 막지 않아야 하고, 화면을 떠난 뒤 늦은 응답이 state를 덮어쓰면 안 된다.
- 현재 저장소의 단건 조회 hook 패턴과 맞고 새 provider/캐시 정책을 도입하지 않는다.

**Alternatives considered**:

- 이미 dependency인 TanStack Query를 앱 전역에 설정: 캐시에는 유리하지만 이 기능 하나를 위해 provider와 전역 정책을 도입하는 비용이 커 기각했다.
- 두 endpoint를 한 hook에서 `Promise.all`: 부분 실패와 독립 retry가 어려워 기각했다.

## Decision 7 — 달성률 계산 경계

**Decision**: 서버는 원본 회차·상태·점수·만점을 제공하고, mapper가 정렬·중복 제거·유효성 검증한 domain 기록을 만든다. 순수 계산 함수가 고유 문제별 최초 완료와 최신 완료의 달성률 차이를 평균하고 표시 직전에만 `%p`로 반올림한다.

**Rationale**:

- identity는 `(examId, questionNumber)`이며 같은 문제의 여러 재답변은 한 문제로 집계한다.
- baseline은 `retryCount=0`의 완료 회차, latest는 가장 큰 `retryCount > 0`의 완료 회차다. 더 최신 pending은 계산에서 제외하되 별도 상태로 남긴다.
- 점수와 만점은 finite, `maxScore > 0`, `0 ≤ score ≤ maxScore`, 최초·최신 max 일치 조건을 통과해야 한다.
- `delta = latestScore/maxScore - initialScore/maxScore`, 평균은 중간 반올림 없이 계산한 뒤 `×100`, 소수 첫째 자리 반올림, negative zero 정규화를 적용한다.

**Alternatives considered**:

- 원점수 차이 평균: 5·6·9점 만점의 1점 의미가 달라 기각했다.
- 100점 환산 점수를 새로 생성: 사용자가 명시적으로 원하지 않았고 `%p`는 달성률 변화임을 더 정확히 드러내므로 기각했다.
- backend가 최종 문자열만 반환: 계산을 검증하거나 edge case를 복구할 수 없어 기각했다.

## Decision 8 — 모의고사 추이 데이터

**Decision**: history contract가 기록용 평균 점수와 그 만점, 최신 5개 trend point, 전체 평균, 개별 시험의 총점·등급·완료 시각을 명시적으로 제공한다. 앱은 `/200` 총점을 임의로 `/5`로 바꾸지 않는다.

**Rationale**:

- 현재 단건 summary에는 `totalScore/200`만 있고 목업의 `/5` 평균 점수는 파생 규칙이 없다.
- server contract가 기록 점수 척도를 명시해야 목업 수치를 추측하지 않고 표시할 수 있다.
- chart에는 최신 5개만 쓰고 기록 목록은 endpoint가 반환하는 순서와 pagination을 따른다.

**Alternatives considered**:

- `totalScore / 200 × 5`: 승인되지 않은 환산이며 목업 값과도 일치하지 않아 기각했다.
- 모든 기록을 한 chart에 표시: 좁은 화면 가독성과 렌더 비용이 나빠 최신 5개로 제한한다.

## Decision 9 — 차트와 등급 색상

**Decision**: 소수의 점과 선은 React Native `View`의 absolute segment/dot으로 그리고 텍스트 대체 정보를 제공한다. 등급색은 전용 surface/text token과 중앙 level-to-band mapping을 사용하며 배지에만 적용한다.

**Rationale**:

- 현재 chart dependency가 없고 최신 5점 line chart에는 새 package가 필요하지 않다.
- grade mapping은 `advanced`, `intermediate-high`, `intermediate-mid`, `intermediate-low`, `novice`, `unknown` 밴드로 한정해 팔레트가 과도하게 늘지 않게 한다.
- AH/AM/AL→advanced, IH→intermediate-high, IM3/IM2/IM1→intermediate-mid, IL→intermediate-low, NH/NM/NL→novice, 그 외→unknown으로 매핑한다.
- 색은 부가 정보이며 배지 문자열과 accessibility label을 항상 유지한다.

**Alternatives considered**:

- `react-native-svg` 추가: 단순 5점 chart에 dependency 추가 근거가 부족해 기각했다.
- 기존 feedback part 상태색 재사용: 서로 다른 의미가 결합돼 향후 토큰 변경이 연쇄되므로 기각했다.
- 모든 세부 등급에 고유 색: 10개 이상의 색을 사용자가 학습해야 하고 색각 접근성이 나빠 밴드 mapping을 선택했다.

## Decision 10 — 배너와 정적 자산

**Decision**: 읽기 전용 성과 배너는 `View`, 빈 상태 CTA는 공용 `Pressable`로 서로 다른 wrapper를 사용한다. `public/icons/chart.png`는 투명 여백을 정리하고 384~512px 범위로 축소한 정적 자산을 `require()`해 장식용으로만 사용한다.

**Rationale**:

- optional `onPress` 하나로 두 상태를 합치지 않으면 성과 배너에 잘못된 button role이나 pressed feedback이 생기지 않는다.
- 원본은 1317×1194, 약 889KB로 80~140pt 배너 장식에 과대하다. 텍스트가 모든 의미를 제공하므로 이미지는 접근성 트리에서 숨긴다.
- `public/image.png`는 전체 화면 디자인 참고 이미지로 런타임 번들에 포함하지 않는다.

**Alternatives considered**:

- 원본 chart 이미지를 그대로 번들: 불필요한 앱 크기와 decode 비용 때문에 기각했다.
- 일러스트에 accessibility label 부여: 같은 정보를 배너 텍스트가 제공해 중복 낭독되므로 기각했다.
