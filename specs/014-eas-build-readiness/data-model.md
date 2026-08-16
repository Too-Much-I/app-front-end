# Data Model: EAS 빌드 준비

이 기능은 런타임 도메인 데이터를 추가하지 않는다. 아래 모델은 저장소와 EAS 원격 상태 사이의 구성
계약을 나타낸다.

## ExpoProjectLink

- `projectId`: `d98fc341-a7a1-467f-8d21-00d0c60e4711`
- `owner`: EAS CLI가 원격 프로젝트에서 확인한 `to-teacher`
- `slug`: 원격 프로젝트에서 확인된 `to-teacher-app`
- 관계: 하나의 앱 구성이 하나의 원격 EAS 프로젝트를 가리킨다.
- 검증: project ID와 원격 slug 정확히 일치, owner 추측 금지, iOS/Android 앱 식별자 불변

상태 전환:

```text
unlinked -> linking -> linked
              |          |
              v          v
           failed   verified(projectId/owner)
```

실패 상태에서는 부분적으로 기록된 config diff를 검토·제거하고, 올바른 계정으로 다시 연결한다.

## BuildProfile

| 이름 | 목적 | distribution | developmentClient | environment | 버전 정책 |
|---|---|---|---|---|---|
| development | 네이티브 개발 | internal | true | development | remote 기준 |
| preview | 내부 검증 | internal | false/default | preview | remote 기준 |
| production | 스토어 제출 | store/default | false/default | production | remote + auto increment |

- 관계: 각 profile은 동일 이름의 BuildEnvironment 하나만 선택한다.
- 검증: 세 이름 누락 금지, production internal distribution 금지, production auto increment 필수

## BuildEnvironment

- `name`: `development | preview | production`
- 공개 앱 변수:
  - `EXPO_PUBLIC_IDENTITY_API_BASE_URL`
  - `EXPO_PUBLIC_LEARNING_API_BASE_URL`
  - `EXPO_PUBLIC_WEB_BASE_URL`
  - `EXPO_PUBLIC_ENABLE_CLARITY`
  - `EXPO_PUBLIC_ENABLE_SENTRY`
- 빌드 비밀: `SENTRY_AUTH_TOKEN`
- 관계: profile과 같은 이름으로 1:1 선택되지만 값은 EAS 원격 저장소가 소유한다.
- 검증: production 필수 URL 누락 시 staging 값으로 fallback 금지, secret의 public 접두사 금지

## SourceMapArtifact

- `platform`: `ios | android`
- `bundle`: Expo export가 생성한 JavaScript bundle
- `sourceMap`: bundle에 대응하는 source map
- `debugId`: Sentry Metro 단계가 생성하는 비어 있지 않은 식별자
- 관계: 각 모바일 bundle과 source map은 동일한 Debug ID로 연계된다.
- 검증: 양 플랫폼 source map의 `debugId` 또는 `debug_id` 존재

## HandoffItem

- `category`: project access, environment, credential, first build
- `location`: repository 또는 Expo/EAS remote
- `owner`: 저장소 개발자 또는 Expo 계정 소유자
- `status`: pending, ready, verified
- 검증: 네 범주가 문서에 모두 있고 비밀 원문은 없음
