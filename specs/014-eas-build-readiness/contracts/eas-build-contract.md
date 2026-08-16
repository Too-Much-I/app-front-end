# Contract: EAS 빌드 구성

## 프로젝트 연결

- 실행 명령: `pnpm dlx eas-cli@latest init --id d98fc341-a7a1-467f-8d21-00d0c60e4711`
- `app.json`의 `expo.extra.eas.projectId`는 위 ID와 정확히 일치해야 한다.
- `expo.owner`는 CLI가 원격 프로젝트에서 확인한 `to-teacher`여야 한다.
- `expo.ios.bundleIdentifier`와 `expo.android.package`는 모두 `com.toteacher.app`을 유지한다.

## `eas.json`

구현 결과는 다음 의미와 구조를 충족해야 한다.

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "pnpm": "11.12.0",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development"
    },
    "preview": {
      "pnpm": "11.12.0",
      "distribution": "internal",
      "environment": "preview"
    },
    "production": {
      "pnpm": "11.12.0",
      "environment": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

Expo/EAS 구성 검사에서는 양 플랫폼의 세 profile이 모두 스키마를 통과하고 각 profile의 `pnpm`이
`11.12.0`인지 확인한다. development와 preview는 내부 배포, production은 store 배포 기본값을 사용하며
각 profile의 `environment`와 production의 자동 증가 정책이 위 계약과 일치해야 한다.

profile 내부에는 API 주소, Sentry token, Apple/Google credential을 직접 기록하지 않는다.

## Metro 구성

최종 Metro config는 다음 변환 순서를 보장해야 한다.

```text
getSentryExpoConfig(projectRoot)
  -> withNativeWind(config, { input: "./global.css", inlineRem: false })
  -> exported Metro config
```

Sentry 단계는 mobile source map에 Debug ID를 제공하고, NativeWind 단계는 기존 CSS 입력과 런타임 rem
동작을 유지한다.

## EAS Environment 변수

| 변수 | 분류 | 앱 번들 포함 | 저장 위치 |
|---|---|---:|---|
| `EXPO_PUBLIC_IDENTITY_API_BASE_URL` | 공개 설정 | 예 | EAS Environment |
| `EXPO_PUBLIC_LEARNING_API_BASE_URL` | 공개 설정 | 예 | EAS Environment |
| `EXPO_PUBLIC_WEB_BASE_URL` | 공개 설정 | 예 | EAS Environment |
| `EXPO_PUBLIC_ENABLE_CLARITY` | 공개 설정 | 예 | EAS Environment |
| `EXPO_PUBLIC_ENABLE_SENTRY` | 공개 설정 | 예 | EAS Environment |
| `SENTRY_AUTH_TOKEN` | 빌드 비밀 | 아니요 | EAS secret |
| Apple/Google credential | 자격증명 | 아니요 | EAS credential 저장소 |
| Firebase 설정/credential | 이번 범위 밖 | 해당 없음 | 후속 작업에서 결정 |

production URL 값은 development/preview 값으로 암묵적으로 대체할 수 없다.
