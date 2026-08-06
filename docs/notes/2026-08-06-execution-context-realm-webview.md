# 실행 컨텍스트부터 WebView 브리지까지 — 블로그 소재 정리

**출발점이 된 실제 문제**: 피드백 웹뷰에서 사용자 답변 오디오 URL이 presigned라
1시간 뒤 만료된다. 앱이 백그라운드에 있다 돌아왔을 때 데이터를 다시 받아야 하는데,
"웹뷰를 통째로 리로드"와 "JS만 다시 실행" 중 무엇이 다른지 설명하려다 보니
실행 컨텍스트 / Realm / 문서 수명주기를 정확히 알아야 했다.

이 문서는 **글감 정리용**이다. 결론을 적어두기보다 "무엇을 공부하고 무엇을 직접
확인해 볼지"를 남긴다.

---

## 전체 구성 제안

한 편에 다 넣으면 너무 길다. 3부작이 자연스럽다.

| 편 | 제목(안) | 축 |
|---|---|---|
| 1 | 실행 컨텍스트는 "코드 뭉치"가 아니다 | 스펙 개념 바로잡기 |
| 2 | 페이지를 새로고침하면 정확히 무엇이 사라지는가 | 상태의 층위 |
| 3 | React Native WebView에 데이터를 다시 내려주기 | 실전 적용 |

각 편이 독립적으로 읽히되, 1편의 개념이 3편의 설계 판단으로 이어지는 구조.

---

## 1편: 실행 컨텍스트

### 핵심 오해부터 깨기

> "실행 컨텍스트 = JS가 실행해야 할 명령어의 집합"

이건 **코드 자체**에 대한 설명이다. 실행 컨텍스트는 명령어가 아니라
**"이 코드를 어떤 주변 환경에서 돌릴 것인가"를 담는 기록**이다.
함수 호출 하나마다 생겼다가 리턴하면 사라진다.

비유: 레시피(명령어)와 주방(실행 컨텍스트). 같은 레시피여도 재료가 어느 선반에
있는지, 지금 누가 요리 중인지는 주방마다 다르다.

### 키워드

- **execution context stack** — 흔히 말하는 콜스택. running execution context는 항상 스택 최상단 하나
- 실행 컨텍스트의 구성 요소
  - `LexicalEnvironment` — 변수를 찾아 올라갈 스코프 체인의 시작점
  - `VariableEnvironment` — `var` 바인딩이 사는 곳 (`let`/`const`와 갈리는 지점)
  - `PrivateEnvironment` — 클래스 `#private` 필드
  - `ThisBinding`
  - `Realm` — 어느 전역 세계 소속인지 (2편으로 이어짐)
  - `ScriptOrModule`
  - **code evaluation state** — 어디까지 실행했는지
- **Environment Record** — 선언적/객체/함수/전역 환경 레코드. `[[OuterEnv]]` 참조가 스코프 체인을 만든다
- **Realm** — 아래 별도 절

### 이 개념으로 설명되는 것들

여기가 글의 재미 포인트. "실행 컨텍스트를 배웠다"로 끝내지 말고,
평소 쓰던 문법이 왜 그렇게 동작하는지로 연결한다.

- **클로저** — 함수가 끝나 실행 컨텍스트가 스택에서 빠져도, 환경 레코드는 힙에 있고
  내부 함수가 그걸 참조하고 있으면 살아남는다. "스택 프레임은 사라지지만 환경은 남는다"
- **호이스팅** — 실행 컨텍스트가 만들어질 때 바인딩이 먼저 생성되고, 초기화는 나중이다.
  `let`/`const`의 TDZ는 "바인딩은 있으나 초기화 전" 상태
- **`this`가 화살표 함수에서 다른 이유** — 화살표 함수는 자기 `ThisBinding`을 만들지 않고
  바깥 환경 레코드의 것을 찾아 올라간다
- **`async`/`await`, 제너레이터** — code evaluation state를 저장해 두고 실행 컨텍스트를
  스택에서 뗐다가 나중에 다시 붙인다. "함수가 중간에 멈춘다"의 실체
- **스택 오버플로** — 재귀가 execution context stack을 소진시키는 것

### 직접 확인해 볼 것

```js
// 클로저: 실행 컨텍스트는 사라져도 환경 레코드는 남는다
function outer() {
  const big = new Array(1e6).fill(0);
  return () => big.length;
}
const fn = outer(); // outer의 실행 컨텍스트는 이미 pop됨
// DevTools Memory 스냅샷에서 big이 여전히 살아있는지 확인
```

```js
// TDZ: 바인딩은 있는데 초기화 전
{
  // console.log(x); // ReferenceError — "정의되지 않음"이 아니라 "아직 초기화 안 됨"
  let x = 1;
}
```

### 참고

- ECMAScript 스펙의 "Executable Code and Execution Contexts" 챕터
  (판(edition)마다 절 번호가 바뀌므로 제목으로 찾을 것)
- MDN: Closures, Execution context

---

## 2편: 새로고침하면 무엇이 사라지는가

### Realm

- **Realm** = 전역 객체(`window`) 하나 + 그에 딸린 내장 객체들(`[[Intrinsics]]`:
  `Object`, `Array`, `Promise`, ...) + 전역 환경 레코드(`[[GlobalEnv]]`)
- 문서 하나당 하나. 문서를 새로 로드하면 Realm이 통째로 교체된다
- 실행 컨텍스트가 "함수 호출마다 생기는 것"이라면, Realm은 "그 문서의 자바스크립트 세계 전체"

### Realm이 여러 개일 때 생기는 실제 버그

이 절이 글의 훅이 될 수 있다. 추상적인 개념이 눈에 보이는 버그로 나타나는 지점.

- iframe 안에서 만든 배열은 부모의 `Array`와 다른 생성자를 갖는다
  → `arr instanceof Array`가 `false`
  → **`Array.isArray()`가 존재하는 이유**가 바로 이것
- 같은 이유로 `instanceof Error`, `instanceof Promise`도 cross-realm에서 깨진다
- `postMessage`로 객체를 넘길 때 구조화 복제(structured clone)가 필요한 이유
- Web Worker = 별도 agent + 별도 realm

### 키워드

- **Realm**, **agent**, **agent cluster** (`SharedArrayBuffer`/`Atomics`가 여기에 걸린다)
- **browsing context / navigable** — HTML 스펙에서 최근 이름이 바뀐 개념
- **document lifecycle**: navigation vs same-document navigation
- **`history.pushState` / `replaceState`** — URL만 바꾸고 Realm은 그대로 → SPA가 성립하는 원리
- **bfcache (back/forward cache)** — Realm을 파괴하지 않고 **얼렸다가 녹인다**.
  `pageshow` 이벤트의 `persisted` 플래그, `pagehide`, `unload` 리스너가 bfcache를 막는 문제

### 상태의 층위 — 이 글의 핵심 표

"상태가 보존된다"는 한 단어로 말할 수 없다. 층이 나뉘고 층마다 규칙이 다르다.

| 층 | 예시 | 문서 리로드 | 같은 Realm에서 JS만 실행 |
|---|---|---|---|
| JS 힙 | React fiber 트리, react-query 캐시, 클로저 변수 | 사라짐 | 유지 |
| DOM / 레이아웃 | 스크롤 위치, 포커스, `:hover` | 사라짐 | 유지 |
| element 내부 상태 | `<audio>.currentTime`, uncontrolled `<input>.value`, `<details open>`, canvas 비트맵 | 사라짐 | **속성 변경 시 리셋될 수 있음** |
| Realm 바깥 | HTTP 캐시, Service Worker, IndexedDB, localStorage | 유지 | 유지 |

세 번째 줄이 실제로 나를 틀리게 만든 지점이다.
`<audio src={url}>`에서 `src`가 바뀌면 브라우저가 미디어 리소스를 새로 로드하며
`currentTime`을 0으로 되돌린다. **Realm이 살아 있다고 element 내부 상태까지
보장되지 않는다.**

presigned URL은 같은 파일을 가리키는데 서명 쿼리스트링만 바뀐다.
"URL 문자열이 달라졌다"와 "다른 리소스다"가 어긋나는 케이스.

### 직접 확인해 볼 것

```js
// 1. cross-realm instanceof
const iframe = document.createElement("iframe");
document.body.append(iframe);
const foreignArray = new iframe.contentWindow.Array();
foreignArray instanceof Array; // false
Array.isArray(foreignArray);   // true
```

```js
// 2. replaceState 후 reload는 어떤 URL을 부르는가
history.replaceState(null, "", "?retryCount=2");
location.reload(); // 새 URL로 로드된다 — Realm은 교체되지만 URL 변경은 남는다
```

```js
// 3. src 교체가 재생 위치를 어떻게 만드는가
audio.currentTime = 10;
audio.src = sameFileNewSignature; // currentTime이 0으로
```

```js
// 4. bfcache
window.addEventListener("pageshow", (e) => console.log("persisted:", e.persisted));
// 뒤로가기로 돌아왔을 때 true면 Realm이 파괴되지 않고 복원된 것
// Chrome DevTools > Application > Back/forward cache 로 진단 가능
```

### 참고

- MDN: Back/forward cache, Window.postMessage, Structured clone algorithm
- HTML 스펙: "Navigables", "Browsing contexts"

---

## 3편: React Native WebView에 데이터를 다시 내려주기

### 문제 정의

- 앱은 웹뷰에 액세스 토큰을 넘기지 않는다. 웹이 "이 데이터가 필요하다"고 요청하면
  네이티브가 자기 토큰으로 API를 호출해 원본을 돌려준다 (인증 프록시)
- 응답에 담긴 사용자 답변 오디오 URL이 **presigned, TTL 1시간**
- 사용자가 앱을 백그라운드에 두고 한참 뒤 돌아오면 그 URL은 죽어 있다

### 두 가지 선택지

| | 웹뷰 리로드 | `injectJavaScript`로 갱신 신호 |
|---|---|---|
| 하는 일 | Realm 교체 | 같은 Realm에서 함수 호출 |
| 스크롤 위치 | 사라짐 | 유지 |
| 스켈레톤 재노출 | 있음 | 없음 |
| 웹 리포 변경 | 불필요 | 필요 |

1·2편의 개념이 그대로 판단 근거가 된다. "무엇이 사라지는지"를 층별로 알면
어느 쪽이 과한 대응인지 바로 보인다.

### 키워드

- **`injectJavaScript`** — 해당 Realm 안에서 코드를 평가한다
- **`window.ReactNativeWebView.postMessage`** — 웹 → 네이티브 단방향 채널
- **주입 문자열 이스케이프** — 페이로드를 객체 리터럴로 이어붙이면 본문에 든 따옴표/개행이
  주입 코드를 깨뜨린다. `JSON.stringify`를 두 번 감싸 **JS 문자열 리터럴로** 심고 웹에서 파싱.
  본질적으로 SQL 인젝션과 같은 종류의 문제
- 주입 코드 끝의 `true;` — iOS에서 평가 결과 경고 회피 관용구
- **`AppState` vs `visibilitychange`** — 웹뷰 안에서 `visibilitychange`는 플랫폼·버전마다
  일관되지 않다. 앱이 백그라운드로 가도 WebView가 "보이는" 상태로 취급되는 경우가 있어
  네이티브 `AppState`를 신뢰원으로 삼아야 한다
- **버전 스큐** — 앱과 웹이 따로 배포되면 신규 신호를 모르는 웹이 존재하는 구간이 생긴다.
  옵셔널 호출로 두어 조용한 no-op이 되게 하고 배포 순서를 정한다

### 캐시 정책과 만료는 다른 축이다

가장 쓸 만한 인사이트가 여기 있다.

react-query 쿼리에 `staleTime: Infinity`가 걸려 있었다. 의도는 명확하다 —
"채점이 끝난 회차의 결과는 바뀌지 않으니 재조회하지 마라". 이 판단은 맞다.

그런데 우리가 갱신하려는 이유는 **데이터가 바뀌어서가 아니라 URL 서명이 만료돼서**다.
두 축이 다르다. `staleTime`을 풀어 간접적으로 재조회를 얻어내면 의도가 흐려지고
원치 않는 상황에서도 재조회가 생긴다. 명시적인 갱신 신호를 받는 편이 낫다.

> 데이터의 신선도(freshness)와 접근 자격의 유효기간(validity)은 별개의 축이다.
> 캐시 정책 하나로 둘 다 처리하려 들면 한쪽이 망가진다.

- **`focusManager`** — react-query가 제공하는 표준 경로. `setEventListener`로 포커스
  신호를 주입하면 `refetchOnWindowFocus`가 동작하고, RN에서 `AppState`를 여기 연결하는 게
  공식 권장 패턴이다. 단 focus 재조회는 **쿼리가 stale일 때만** 일어나므로
  `staleTime: Infinity`와는 함께 쓸 수 없다. 이 제약을 아는 것이 위 결론의 근거
- **`refetch()` vs `invalidateQueries()`** — 전자는 지금 보는 쿼리만, 후자는 키 접두사가
  같은 캐시 전체를 stale로 찍는다. 사용자가 여러 회차 칩을 눌러 봤다면 다른 회차 캐시에도
  만료된 URL이 남아 있다

### 남는 문제 (글의 마무리로 좋음)

- 포그라운드 복귀만 감지하면, **앱을 계속 켜둔 채 1시간을 넘긴 경우**는 못 잡는다.
  결국 만료는 시간의 문제이지 이벤트의 문제가 아니다
- 재생 실패를 감지해 그때 갱신하는 방식이 더 정확하지만 복잡하다.
  이벤트 기반 갱신과 실패 기반 복구 중 어디까지 할 것인가
- presigned 서명만 바뀐 같은 리소스를 "같다"고 볼 방법 —
  쿼리스트링을 뗀 경로를 비교 기준으로 삼으면 파형 재추출과 재생 리셋을 피할 수 있다.
  URL을 식별자로 쓸 때의 일반적인 함정

---

## 글쓰기 메모

- **1편의 훅**: "실행 컨텍스트가 명령어의 집합이라고 생각했다"는 오해를 먼저 세우고 깨기.
  많은 사람이 같은 오해를 한다
- **2편의 훅**: `Array.isArray()`가 왜 존재하는지. 답이 Realm이라는 게 의외성이 있다
- **3편의 훅**: 표 하나(리로드 vs 주입)로 시작해서 "왜 그런지"를 1·2편으로 되짚기
- 실제로 **내가 틀렸던 지점**(재생 상태가 유지된다고 잘못 말한 것)을 그대로 쓰는 게
  글을 살린다. 개념을 반쯤 알면 정확히 어떻게 틀리는지를 보여주는 사례다
- 코드 예제는 전부 DevTools 콘솔에서 바로 돌려볼 수 있는 것으로 유지
