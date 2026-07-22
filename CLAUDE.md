# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
pnpm install
pnpm start          # Expo dev server — scan QR with Expo Go, or press i/a for simulator
pnpm ios            # run in iOS simulator (requires Xcode)
pnpm android        # run in Android emulator (requires Android Studio)
pnpm web            # run in browser
pnpm lint           # oxlint
```

No test runner is configured yet.

## Architecture

This is an Expo (React Native) app, not a website — see [docs/why-expo-react-native.md](docs/why-expo-react-native.md) for why it isn't a Capacitor/WebView wrapper around the existing `web-front-end`, and [docs/why-new-repo-and-partial-copy.md](docs/why-new-repo-and-partial-copy.md) for why this is a fresh repo with only specific files ported over rather than a shared workspace package.

### Path alias

`@/*` → `./src/*` is registered in **two** places that must be kept in sync: `tsconfig.json` (`paths`, for type-checking) and `babel.config.js` (`babel-plugin-module-resolver`, for Metro bundling). Metro does not read `tsconfig.json` paths itself, unlike Vite/webpack.

### Env vars

Only vars prefixed `EXPO_PUBLIC_` are inlined into the client bundle (`process.env.EXPO_PUBLIC_*`), equivalent to Vite's `VITE_` or Next's `NEXT_PUBLIC_` prefix. See `.env.local.example`.

### Styling

NativeWind (Tailwind for RN) — use `className` on RN components. Entry stylesheet is `global.css`, wired through `metro.config.js` (`withNativeWind`) and `babel.config.js` (`nativewind/babel` preset). Tailwind content globs cover `App.tsx` and `src/**/*.{js,jsx,ts,tsx}`.

### API layer: ported from `web-front-end`, not native-first

`src/lib/api/client.ts`, `src/types/api.ts`, `src/types/exam.ts`, and everything under `src/features/exam/` were copied from the original Next.js web app's proven API layer (see the "무엇을 가져왔고" section of [docs/why-new-repo-and-partial-copy.md](docs/why-new-repo-and-partial-copy.md)). No UI/screens were carried over — those are being built fresh for this app.

- `apiFetch<T>()` (`src/lib/api/client.ts`) wraps `fetch` with an `EXPO_PUBLIC_API_BASE_URL` prefix, a timeout/`AbortController`, and throws `ApiError` on non-OK responses.
- Every server response is an `ApiEnvelope<T>` (`{ isSuccess, code, message, result }`, `src/types/api.ts`); endpoint functions unwrap `.result`.
- Domain types follow a `Raw* → mapper → domain` split (e.g. `RawExamSession` → `mapExamSession()` → `ExamSession`, in `src/types/exam.ts` / `src/features/exam/map-exam-session.ts`). Field name/shape mismatches between the Swagger spec and actual server responses (snake_case vs camelCase, `null` instead of `[]`, etc.) are normalized in the mappers — the quirks are documented inline at the `Raw*` type or mapper, and in `docs/*-fix.md` for ones with a longer debugging history.
- `src/features/exam/api/*.ts` holds one file per endpoint (session create, answer upload, grading status/result, question feedback, terminate). `exam-answer-upload.ts` is the most involved: it chains presigned-URL fetch → S3 PUT (with exponential backoff, capped by the URL's actual expiry) → submit-for-grading, and distinguishes which stage failed via `ExamAnswerUploadError.stage`.

**Not yet ported to RN**: `use-answer-recorder.ts` and `use-grading-progress.ts` still carry `"use client"` directives and browser-only APIs (`MediaRecorder`, `navigator.mediaDevices.getUserMedia`, `AudioContext`) from the original web app. These will not run in React Native as-is and need reimplementation against Expo's audio APIs (`expo-audio`) before the recording flow can be used.

### Assets

`public/mascots/*` and `public/assets/audio/*` were ported for reuse in exam screens, but RN can't serve them by URL path like a web app — they must be loaded via `require()`/`import`, not referenced as string paths.

### Not yet wired up

`@react-navigation/native`, `native-stack`, and `bottom-tabs` are installed but no navigator is set up yet — `App.tsx` is still the default Expo scaffold. `zustand` and `@tanstack/react-query` are installed but unused so far.

### Cross-platform (iOS/Android) consistency

- **Font**: use Google Font **Jua** everywhere (`@expo-google-fonts/jua`, loaded via `expo-font`'s `useFonts`) instead of the system default (San Francisco on iOS, Roboto on Android). A custom font renders pixel-for-pixel the same on both platforms, so this sidesteps the iOS/Android font-metric mismatch entirely rather than compensating for it.
- **Shadows**: iOS (`shadowColor`/`shadowOffset`/`shadowOpacity`/`shadowRadius`) and Android (`elevation`) use unrelated APIs. Don't branch on `Platform.OS` per screen — define shadow presets once in a shared theme/style layer and reuse them (NativeWind's `shadow-*` utilities already handle both platforms under the hood).
- **Touch feedback**: iOS convention is opacity change on press, Android convention is a ripple. Put this in one shared `Pressable`-based button component (e.g. `android_ripple` prop) rather than reimplementing per screen.
- **Safe area**: notch/Dynamic Island (iOS) vs status bar (Android) differ. Wrap the app once in `SafeAreaProvider` (`react-native-safe-area-context`, already installed) and consume insets via `useSafeAreaInsets`/`SafeAreaView` in screens — don't hardcode top/bottom padding.
- **Navigation transitions**: `@react-navigation/native-stack` already follows each platform's native transition (iOS slide-in, Android fade-up). Don't override this to force visual parity — matching each OS's own convention is the correct UX here, unlike the items above.
- **Tablet layout**: `app.json` sets `ios.supportsTablet: true`; Android has no equivalent toggle and supports tablets by default. Build layouts with flex/relative sizing rather than fixed pixel dimensions so they don't break on larger screens.
