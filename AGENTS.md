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

Code quality follows the four [Frontend Fundamentals](https://frontend-fundamentals.com/code-quality/) criteria:

- **Readability**: Reduce context (split code that never runs together, abstract implementation details), name things (complex conditions, magic numbers), and let the file read top to bottom so the reader's eye moves less.
- **Predictability**: Avoid overlapping names, return the same type from functions of the same kind, and surface hidden logic rather than burying side effects.
- **Cohesion**: Keep files that change together in the same directory, and eliminate magic numbers.
- **Coupling**: One responsibility per unit, allow duplication when removing it would couple unrelated code, and eliminate props drilling.

These four criteria conflict with each other. Removing duplication raises coupling; abstracting to reduce context adds indirection. Where they conflict, ask the user instead of resolving it unilaterally.

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
- `src/features/exam/use-answer-recorder.ts` is Expo-native and owns answer recording lifecycle only. Grading progress is polled by `use-grading-status.ts`; the browser-only `use-grading-progress.ts` carried over from the web app has been deleted, so do not resurrect it.

## How we work

See `docs/how-we-work.md` for the full description. Medium or larger work follows five steps:

1. **The agent presents the current state and options.** Current code flow with `file:line` references, two or three options, and the tradeoff of each. Do not pick for the user.
2. **The user decides.**
3. **The user writes skeleton code.** State definitions, branch conditions, state transitions, error paths, and which UI corresponds to each state. Imports, type declarations, mappers, styling, and API signature accuracy are intentionally omitted, and it does not need to run.
4. **The agent implements it.** Report every point where the implementation diverged from the skeleton and why. When the code-quality criteria below conflict, ask instead of deciding unilaterally.
5. **The user confirms and explains the flow back.** The agent points out gaps in that explanation.

Only steps 1, 2, and 5 produce documents, and all of them are written *after* the work. There is no artifact to read and approve before implementation.

- Record decisions in `docs/decisions/YYYY-MM-DD-<topic>.md`, one per feature, targeting 80 lines or fewer. `docs/how-we-work.md` holds the section format.
- Treat Jira issues and user requests as requirements input, not direct implementation commands. Separate confirmed facts, assumptions, ambiguities, scope, and acceptance criteria before deciding.
- Keep Jira reads separate from Jira writes. Do not change issue status, comments, assignees, or other external state unless the user explicitly requests it.
- `specs/` is a frozen archive. Several `plan.md` files there still contain `/speckit-*` directives for a workflow that no longer exists in this repository; do not follow them and do not add new documents there.

## Change discipline

- Before editing code, think through the task carefully, inspect the related code and documentation, produce a concise design, and communicate relevant tradeoffs; only then make changes.
- Keep changes scoped to the request and preserve unrelated working-tree modifications.
- Do not edit generated files, dependency lockfiles, or assets unless the requested change requires it.
- Update documentation when changing an architectural rule, environment setup, or a non-obvious API workaround.
- Before handing off, review the diff and state which validation commands were run and whether they passed.

## Commits and pull requests

- Do not create commits unless explicitly requested. When asked, stage only changes within the requested scope and use a Conventional Commit title with an optional scope, such as `feat(mock-exam): 파트별 안내 화면 추가`.
- Write commit subjects and bodies in Korean. Keep the Conventional Commit type and optional scope in their standard lowercase English form.
- Add a commit body only when the rationale, constraints, or follow-up work cannot be understood from the title and diff.
- Use `.github/pull_request_template.md` when preparing a PR description. State the intended user outcome before implementation details, and record non-obvious decisions, tradeoffs, and intentional exclusions so human and automated reviewers can distinguish deliberate behavior from defects.
- Keep PR sections concise and remove optional sections that add no review value instead of repeating the diff.
