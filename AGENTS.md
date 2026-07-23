# AGENTS.md

This file contains repository-level instructions for coding agents. It applies to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Project overview

- This is an Expo 57 / React Native application written in strict TypeScript.
- Use `pnpm` (the repository pins `pnpm@11.12.0`). Do not create npm or Yarn lockfiles.
- This is a native app, not a conventional website. Prefer React Native and Expo APIs over browser-only APIs.
- Import application code through the `@/*` alias when practical. The alias maps to `src/*` in both `tsconfig.json` and `babel.config.js`; keep both configurations synchronized if it changes.

## Common commands

```sh
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm web
pnpm lint
pnpm exec tsc --noEmit
```

No automated test runner is configured yet. For code changes, run `pnpm lint` and `pnpm exec tsc --noEmit` unless the change is documentation-only. Report any check that cannot be run and why.

## Repository structure

- `src/screens/`: screen-level UI grouped by feature.
- `src/components/ui/`: shared UI primitives.
- `src/navigation/`: root, tab, and stack navigation plus route types.
- `src/features/exam/`: exam domain logic, response mappers, API calls, and hooks.
- `src/lib/api/client.ts`: shared API client.
- `src/theme/`: design tokens, typed token exports, fonts, and shared styles.
- `src/types/`: API and domain types.
- `docs/`: architecture decisions and debugging history.
- `assets/`: Expo-managed application assets.
- `public/`: assets ported from the web app; React Native code must load them with static `require()`/imports rather than URL paths.

## Coding conventions

- Preserve strict TypeScript. Avoid `any`, unsafe casts, and type suppression unless there is a documented external boundary that requires them.
- Keep components and functions focused. Put reusable behavior in the existing feature, theme, or UI layers rather than duplicating it in screens.
- Follow the existing formatting and import style. Prefer type-only imports where applicable.
- Keep navigation parameter types in `src/navigation/types.ts` and type every new route.
- Do not add dependencies unless the task genuinely requires one. Prefer Expo-compatible packages and verify compatibility with the installed Expo SDK.
- Never expose secrets in client code. Only `EXPO_PUBLIC_*` variables are intended to be bundled, and those values must be treated as public.

## UI and styling

- Use NativeWind `className` utilities for ordinary React Native styling.
- Reuse design tokens from `src/theme/tokens.js` through the typed exports in `src/theme/index.ts`. Do not scatter hard-coded colors, font sizes, spacing values, or shadows when a shared token is appropriate.
- `tokens.js` intentionally remains CommonJS JavaScript so `tailwind.config.js` can load it.
- Use `src/components/ui/Text.tsx` instead of React Native's `Text`. The app uses the Jua font, which has one weight; do not apply synthetic `font-medium` or `font-bold` weights.
- Use `src/components/ui/Pressable.tsx` instead of React Native's `Pressable` to preserve consistent cross-platform feedback.
- Account for safe-area insets instead of hard-coding status-bar or home-indicator padding.
- Build responsive layouts with flex and relative sizing so screens work on phones and tablets.
- Centralize iOS/Android shadow differences in shared theme primitives. Do not add per-screen `Platform.OS` branches solely for visual parity.

## API and exam-domain conventions

- Use `apiFetch<T>()` from `src/lib/api/client.ts` for application API requests.
- Server responses use `ApiEnvelope<T>`; endpoint modules should unwrap and return `result` consistently with the existing API files.
- Preserve the `Raw* -> mapper -> domain type` boundary. Normalize server inconsistencies in a mapper rather than leaking nullable, snake_case, or unstable response shapes into UI code.
- Keep one endpoint per file under `src/features/exam/api/` and document non-obvious backend quirks close to their raw types or mappers.
- `src/features/exam/use-answer-recorder.ts` and `use-grading-progress.ts` still contain browser-only code. Do not treat them as React Native-compatible until they are explicitly reimplemented using Expo-native APIs.

## Change discipline

- Before editing code, think through the task carefully, inspect the related code and documentation, produce a concise design, and communicate relevant tradeoffs; only then make changes.
- Keep changes scoped to the request and preserve unrelated working-tree modifications.
- Do not edit generated files, dependency lockfiles, or assets unless the requested change requires it.
- Update documentation when changing an architectural rule, environment setup, or a non-obvious API workaround.
- Before handing off, review the diff and state which validation commands were run and whether they passed.

## Commits and pull requests

- Do not create commits unless explicitly requested. When asked, stage only changes within the requested scope and use a Conventional Commit title with an optional scope, such as `feat(mock-exam): add part guidance`.
- Add a commit body only when the rationale, constraints, or follow-up work cannot be understood from the title and diff.
- Use `.github/pull_request_template.md` when preparing a PR description. State the intended user outcome before implementation details, and record non-obvious decisions, tradeoffs, and intentional exclusions so human and automated reviewers can distinguish deliberate behavior from defects.
- Keep PR sections concise and remove optional sections that add no review value instead of repeating the diff.
