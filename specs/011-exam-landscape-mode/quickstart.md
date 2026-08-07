# Quickstart: Part 4 표 가로 전체화면 검증

## Prerequisites

- pnpm 11.12.0
- Expo 57 development client rebuilt after native dependency/config changes
- Part 4 표가 포함된 exam session fixture or development API response
- iOS Simulator plus an iPhone/iPad real-device pass when available
- Android Emulator plus a phone/tablet real-device pass when available

`expo-screen-orientation`와 iOS orientation capability는 native binary에 포함되어야 하므로 Metro
reload만으로는 검증할 수 없다.

## Static checks

```sh
pnpm install
pnpm lint
pnpm exec tsc --noEmit
```

Expected:

- Both commands exit successfully.
- `package.json` and `pnpm-lock.yaml` resolve `expo-screen-orientation` to Expo 57's compatible `~57.0.1`.
- No npm or Yarn lockfile is created.

## Native configuration checks

Regenerate/rebuild the development clients through the project's normal Expo workflow, then inspect the
generated local native projects without committing them.

Expected iOS configuration:

- `UIRequiresFullScreen` is true.
- `EXDefaultScreenOrientationMask` is portrait.
- iPhone and iPad `UISupportedInterfaceOrientations` include portrait, landscape-left and landscape-right.

Expected Android configuration:

- The default activity orientation remains portrait before JavaScript requests any exception.
- A runtime landscape request succeeds and portrait restore succeeds.

Run the platform clients:

```sh
pnpm ios
pnpm android
```

## Scenario 1: portrait is the default and the button is the only trigger

1. Launch the app while holding/rotating the device to landscape before opening Part 4.
2. Confirm the normal portrait-only notice appears and the app does not open the landscape table.
3. Return to portrait and enter the Part 4 reading screen.
4. Do not press the landscape button; physically rotate the device.
5. Confirm the landscape table does not open and the normal portrait policy remains active.
6. Return to portrait and press the dedicated landscape-table button once.
7. Confirm one landscape transition and one full-screen table modal occur.

## Scenario 2: table-only landscape presentation

1. In the landscape modal, compare title, subtitles, metadata, columns, rows, status badges and notes with
   the portrait table.
2. Confirm exam header, question progress, timer, waveform, answer status/actions and system status bar are
   absent.
3. Confirm the close control remains reachable around notches, rounded corners and tablet insets.
4. Use the maximum reference table and scroll from first to last column, first row to last row and final note.
5. Repeat with the largest supported system text size and confirm no information is permanently clipped.
6. Use VoiceOver/TalkBack to verify the landscape action, column/value semantics and close action.

## Scenario 3: timer, audio and recorder continuity

1. Open landscape during the 45-second Part 4 reading phase, wait 10 seconds, then close it.
2. Confirm the returned timer reflects elapsed time rather than pausing or resetting.
3. Let the 45-second timer expire while landscape remains open.
4. Confirm the same table remains visible as the controller advances to Q8; close and verify the current
   preparation/cue phase.
5. Open/close landscape during question audio, preparation, recording and finalization.
6. Confirm audio/recording is not restarted, duplicated or interrupted solely by the presentation change.
7. Confirm each answer still registers once and normal automatic question progression continues.

## Scenario 4: close and automatic recovery

1. Press the in-modal close action and confirm one portrait transition back to the current exam phase.
2. Reopen it on Android and press system back; confirm only the landscape modal closes and the exam does not
   navigate away.
3. Rapidly press the enter action; confirm only one modal and one transition occur.
4. Trigger close/back while the device is still entering landscape; confirm the final orientation is portrait.
5. Keep the modal open across Q8→Q9 and verify it may remain because the canonical table is unchanged.
6. Keep it open across Part 4→Part 5/submission and verify it closes automatically and restores portrait.
7. Exit/replace the exam screen while open and verify Home/Grading/other screens start in portrait with the
   normal landscape notice restored.
8. Background and foreground the app during enter, landscape and restore states; confirm no duplicate
   timer/audio/recorder lifecycle is created.

## Scenario 5: failure fallback

1. In a development build, force `supportsOrientationLockAsync(LANDSCAPE)` to report false or make the lock
   reject through a temporary test seam; do not retain the seam after validation.
2. Press the landscape button and confirm the regular portrait exam remains usable with no blank modal.
3. Force portrait restore to reject and confirm the orientation state returns to normal policy so the existing
   portrait notice can guide manual recovery.
4. Restore production behavior and re-run lint/typecheck.

## Regression checks

- Part 1, 2, 3 and 5 screens remain portrait and expose no landscape-table action.
- Reanswer Part 4 table remains unchanged and exposes no action.
- Existing `Part4Table.onReady` starts the 45-second reading timer once; modal layout does not restart it.
- Existing physical-landscape notice still covers all non-exempt app screens.
- Web/typecheck builds do not crash when native orientation lock is unavailable; portrait content remains the
  fallback.

## Artifact traceability

- State ownership and transitions: [data-model.md](./data-model.md)
- UI, lifecycle and native configuration contract:
  [contracts/landscape-table-ui-contract.md](./contracts/landscape-table-ui-contract.md)
- Technical decisions and rejected alternatives: [research.md](./research.md)

## Implementation validation (2026-08-07)

Completed in the repository workspace:

- `CI=true pnpm lint` — PASS
- `CI=true pnpm exec tsc --noEmit` — PASS
- `CI=true pnpm exec expo install --check` — PASS against Expo 57's local bundled native module map;
  the remote well-known versions endpoint was unavailable in the restricted environment.
- `CI=true pnpm exec expo config --type prebuild --json` — PASS; the screen-orientation plugin is
  registered with `PORTRAIT_UP` and iPad `requireFullScreen` is enabled.
- `CI=true pnpm exec expo config --type introspect --json` — PASS; generated iOS configuration has
  `UIRequiresFullScreen=true`, `EXDefaultScreenOrientationMask=UIInterfaceOrientationMaskPortrait`,
  and portrait plus both landscape capabilities for iPhone and iPad. Generated Android configuration
  keeps `MainActivity` at `android:screenOrientation="portrait"` before runtime requests.

Not run in this terminal-only validation:

- iOS/Android development-client rebuild and launch
- iPhone/iPad and Android phone/tablet rotation, safe-area, hardware-back and large-text scenarios
- live exam timer, audio, recorder and Part 4 automatic progression scenarios
- forced native support/lock rejection seams

These checks require rebuilt native clients, simulator/emulator controls or real devices, and a Part 4
exam fixture/API session. They remain the required pre-release device pass described above.
