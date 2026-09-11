# 터치 breadcrumb 컴포넌트 경로

## 문제

크래시·운영 에러 제보를 받아도 **사용자가 어느 화면의 무엇을 눌렀는지** 알 방법이 없다.

Sentry SDK는 `Sentry.wrap(RootComponent)`이 마운트하는 `TouchEventBoundary`를 통해
터치가 일어날 때마다 `category: "touch"`, `data: { path: [...] }` 형태의 breadcrumb를
자동으로 쌓는다. `path`는 터치 지점부터 루트까지 컴포넌트 트리를 거슬러 올라가며 모은
항목의 배열이고(최대 20개, SDK의 `maxComponentTreeSize` 기본값), 각 항목은
`{ name, element, file, label }`이다.

그런데 이 값이 전송 전에 전부 지워진다. `isSensitiveKey`가 키 이름만 보고 판정하는데
`path`가 `SENSITIVE_EXACT_KEY_PATTERN`([sentry.ts:24](../../src/lib/sentry.ts#L24))과
`SENSITIVE_SUFFIX_KEY_PATTERN`([sentry.ts:26](../../src/lib/sentry.ts#L26)) 양쪽에
들어 있어, `scrubBreadcrumb`의 `scrubRecord(breadcrumb.data)`가 통째로 `[Filtered]`로
바꾼다. 이 규칙은 URL 경로가 breadcrumb에 실려 나가는 걸 막으려고 넣은 것이라
의도 자체는 맞지만, 터치 경로는 **이름만 같고 성격이 다른 값**이다.

`message`도 남지 않는다. `scrubBreadcrumb`은 예외 없이 `message: undefined`로
지우고([sentry.ts:193](../../src/lib/sentry.ts#L193)), 이는 자유 텍스트를 패턴
매칭만으로는 못 믿겠다는 기존 정책이다
([2026-09-01 결정 기록](2026-09-01-시험-세션-breadcrumb-watchdog-설계-원칙.md)의
"app lifecycle 배치" 절). 결과적으로 터치 breadcrumb에는 `category`와 타임스탬프
말고 남는 게 없어, 타임라인에 `touch`만 줄줄이 찍힌다.

같은 문서가 이 지점을 명시적으로 미뤄 뒀다 — "`scrubBreadcrumb`은 앱 전체
breadcrumb(Sentry 자동 breadcrumb 포함)에 걸리는 공유 인프라라 이번 범위에서는
건드리지 않기로 했다." 이번 결정은 그 유예를 여는 것이다.

한 가지가 더 얽힌다. `path` 항목의 `name`/`element`/`file`은 저절로 생기지 않는다.
`@sentry/babel-plugin-component-annotate`가 빌드 타임에 JSX prop으로 박아 줘야 하고,
그건 `metro.config.js`의 `annotateReactComponents` 옵션으로 켠다. 플러그인이 없으면
SDK는 `elementType.displayName`으로만 `name`을 채우는데, 함수 컴포넌트 대부분은
`displayName`이 없어 항목이 통째로 버려진다(SDK의 `_pushIfNotIgnored`는 `name`도
`label`도 없는 항목을 넣지 않는다). **즉 metro와 sentry.ts 중 한쪽만 바꾸면 조용히
무력화된다.**

## 선택지

| 안 | 내용 | 트레이드오프 |
|---|---|---|
| A | 지금처럼 둔다. `path`를 계속 통째로 지우고 터치 지점 추적은 포기한다 | 스크러버에 예외가 하나도 없어 "키 이름만 보고 지운다"는 규칙이 단순하게 유지된다. 대신 재현 불가 제보의 진단 수단이 계속 없다 |
| B | 터치 breadcrumb에 한해 `path`를 되살리되, 빌드 타임 소스 식별자(`name`/`element`/`file`)만 남기고 `label`은 버린다 | 유일한 런타임 값인 `label`을 버리므로 사용자 텍스트 유입 경로가 구조적으로 없다. 대신 `isSensitiveKey`의 단순한 규칙에 category 조건부 예외가 처음 생기고, 허용 필드 목록을 SDK 변경에 맞춰 사람이 따라가야 한다 |
| C | `path`를 통째로 되살리고 `redactIdentifiers`의 패턴 매칭에 맡긴다 | 코드가 가장 적고 SDK가 필드를 추가해도 자동으로 따라간다. 대신 `label`이 그대로 통과한다 — `redactIdentifiers`는 URL·UUID·Bearer 토큰 같은 **알려진 형태**만 지우지, 실명이나 화면 문구는 못 거른다 |
| D | `sentry-label` prop을 앱에서 안 쓰기로 정하고 `path` 전체를 통과시킨다 | 지금은 사용처가 0건이라 당장 동작이 C와 같으면서 위험은 없다. 대신 정책을 코드가 아니라 규율로 지키는 셈이라, 나중에 누가 label을 붙이는 순간 조용히 뚫린다. `check:naming`류로 막을 수단도 없다 |
| E | `metro.config.js`는 그대로 두고 sentry.ts만 고쳐 `displayName`으로 버틴다 | 빌드 타임 비용(트랜스폼 시간, JSX prop 3개만큼의 번들 증가)이 없다. 대신 함수 컴포넌트에는 `displayName`이 없어 경로가 사실상 비어 나온다 — 비용은 줄지만 얻는 것도 거의 없다 |

<!-- 아래 4개 섹션은 AGENTS.md 규약상 사람이 작성한다. -->

## 결정

## 코드 흐름 변화

## 뼈대 → 구현에서 달라진 것

## 기준 충돌
