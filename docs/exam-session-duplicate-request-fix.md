# 시험 세션 생성 API 중복 요청 수정

백엔드 쪽에서 `POST /api/v1/exams`가 로그에 두 번씩 찍힌다고 알려온 문제의 원인과, 고친 방식·검토한 대안·범위를 이렇게 좁힌 이유를 정리한다.

## 1. 배경

PR #13(`feat/#12-backend`, "백엔드 연동 완료")에서 `src/app/exam/session/page.tsx`가 mock 데이터 대신 실제 `POST /api/v1/exams`로 시험 세션을 생성하도록 바뀌었다. 이 변경을 받아 로컬에서 확인하던 중, 백엔드가 같은 세션 생성 요청이 두 번 들어온다고 로그로 확인해줬다.

## 2. 원인

문제의 코드는 다음과 같은 구조였다.

```tsx
useEffect(() => {
  async function createExam() {
    const response = await apiFetch(...POST /api/v1/exams...);
    setSession(mapExamSession(response.result));
  }
  createExam();
}, []);
```

이 프로젝트는 `next.config.ts`에 `reactStrictMode`를 명시적으로 끄지 않아 기본값(`true`)이 적용된다. React 18+의 StrictMode는 개발 모드에서 컴포넌트를 의도적으로 `mount → unmount → mount`시켜, `useEffect`가 부수효과(cleanup 없는 subscription, 외부 상태 변경 등)에 안전하게 대응하는지 검증한다. 이 자체는 정상 동작이자 권장되는 개발 도구다.

문제는 이 `useEffect`가 "세션 생성"이라는 **멱등하지 않은(non-idempotent) 부수효과**(서버에 새 리소스를 만드는 POST)를 아무 가드 없이 실행한다는 점이었다. StrictMode가 effect를 두 번 실행하면 `createExam()`도 그대로 두 번 호출되어, 서버에 시험 세션이 두 개 생성되고 두 번째 응답으로 화면 상태가 덮어써졌다. 첫 번째로 만들어진 세션은 프론트 어디에서도 참조되지 않는 채로 서버에만 남는다.

## 3. 검토한 해결 방안

- **`reactStrictMode: false`로 전역 비활성화**
  가장 빠르지만, 이 프로젝트 전체에서 StrictMode가 잡아주는 다른 잠재적 버그(cleanup 누락, 오래된 클로저 등)까지 같이 꺼버린다. 이번 문제는 "이 effect 하나가 멱등하지 않다"는 국소적 원인인데, 해결 범위를 프로젝트 전역으로 넓힐 이유가 없어 제외했다.
- **`AbortController`로 cleanup에서 첫 요청을 취소**
  StrictMode의 mount→unmount→mount 사이클에 맞춰 `useEffect`가 cleanup 함수로 `controller.abort()`를 반환하게 하는 방법도 가능하다. 다만 POST 요청은 취소 시점에 이미 서버에 도달해 리소스 생성이 끝났을 수 있어(네트워크 왕복 시간과 abort 타이밍의 경쟁), "요청이 서버에 도달하기 전에 취소된다"는 보장이 없다. 즉 이 방법은 중복 생성을 막는 게 아니라 "운이 좋으면 막힐 수도 있는" 방식이라 채택하지 않았다.
- **`useRef` 플래그로 실제 호출 자체를 가드 (채택)**
  ```tsx
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    createExam();
  }, []);
  ```
  `ref` 값은 같은 컴포넌트 인스턴스의 mount→unmount→mount 사이에도 유지되므로, 첫 번째 mount에서 세팅한 `true`를 두 번째 mount에서도 그대로 읽는다. 그래서 실제 `createExam()` 호출 자체가 정확히 한 번만 일어나는 걸 보장할 수 있다. 프로덕션 빌드에서는 애초에 StrictMode 이중 mount가 없으므로 이 가드는 항상 조건을 통과하며(no-op), 부작용이 없다.

## 4. 범위를 이 effect 하나로 좁힌 이유

프로젝트 전체의 `useEffect`를 훑어본 결과, `useEffect` 안에서 POST/PUT/PATCH 같은 변경성 요청을 직접 실행하는 곳은 이 세션 생성 코드가 유일했다. 그 외 `useEffect`들(폴링, 오디오 큐, URL 동기화 등)은 GET 기반이거나 서버 상태를 변경하지 않는 로직이라 중복 실행돼도 결과가 달라지지 않는다(멱등). 그래서:

- 재사용 가능한 "run-once effect" 훅으로 추상화하지 않고 `useRef` 가드를 이 파일에 직접 인라인으로 뒀다. 현재 이런 패턴이 딱 한 곳뿐이라, 두 번째 사용처가 생기기도 전에 공용 훅을 만드는 건 과도한 추상화라고 판단했다.
- StrictMode 자체나 `apiFetch` 클라이언트 등 더 넓은 범위는 건드리지 않았다. 문제의 본질이 "멱등하지 않은 호출에 가드가 없었다"는 이 effect 하나의 이슈였기 때문이다.

## 5. 남은 과제

- 서버 쪽에서도 동일 사용자의 중복 세션 생성을 막는 멱등성 키(idempotency key) 등을 고려할 수 있는지는 백엔드와 별도 논의가 필요하다. 프론트 가드는 "같은 컴포넌트 인스턴스 내 중복 호출"만 막을 뿐, 새로고침이나 다른 탭에서의 중복 생성까지 막지는 못한다.
