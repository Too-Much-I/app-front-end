# UI Contract: Part 4 Landscape Table Mode

## Eligibility and trigger

- The live Part 4 reading table and live Part 4 question table expose one clearly labelled landscape-view
  button when the table is displayable.
- Reanswer tables and non-Part-4 content do not expose the action.
- The app and exam remain portrait by default.
- Physical device rotation, accelerometer output, window aspect ratio, or automatic-rotation preference
  alone never opens the landscape table.
- Only a press on the dedicated button requests landscape mode.
- While an enter/restore transition is pending, a second enter request is not accepted.

## Orientation coordinator contract

The app-level coordinator exposes these observable values and actions:

```text
mode:
  portrait | entering-landscape | landscape | restoring-portrait

isLandscapeTableRequested:
  true for entering-landscape, landscape, restoring-portrait

requestTableLandscape():
  resolves true only when a supported landscape lock is applied
  resolves false after restoring the portrait fallback when unsupported or rejected

restorePortrait():
  idempotent
  resolves after the final portrait lock attempt
```

The coordinator guarantees:

- native orientation operations are serialized;
- restore is the final operation after an overlapping enter/exit sequence;
- app mount reinforces portrait lock;
- foreground entry reapplies the latest desired lock, including portrait cleanup requested in background;
- no table data is stored or logged;
- the normal portrait-only notice is suppressed only while
  `isLandscapeTableRequested` is true.

## Part4Table action contract

The shared renderer accepts an optional landscape request callback.

- When absent, table layout and behavior are unchanged and no button is rendered.
- When present, the button has button semantics, an accessible name describing landscape enlargement,
  a minimum touch target, and visible pressed/disabled feedback through the shared Pressable primitive.
- The action is outside the horizontal grid scroll gesture area so a horizontal swipe does not trigger it.
- Rendering the action must not call or replace the existing one-shot `onReady` contract.

## Landscape modal contract

Inputs:

```text
visible: boolean
table: ExamTableContext
transitioning: boolean
onRequestClose(): void
```

Observable behavior:

- It uses a native full-screen modal without navigating away from `ExamSessionScreen`.
- It renders the existing `Part4Table` content: title, subtitles, metadata, column headers, every row,
  status notes and notes in the same order and formatting as portrait.
- It does not render exam header, question progress, timer, waveform, answer status, answer actions or
  preparation/response controls.
- It hides the system status bar while mounted and restores the previous status-bar policy when closed.
- It respects left, right, top and bottom safe-area insets; a notch or rounded corner cannot cover table
  content or the close action.
- The outer container scrolls vertically; the existing grid scrolls horizontally. Neither direction clips
  permanently inaccessible content.
- A fixed, accessible close action is the only non-table control.
- Android `onRequestClose` emits the same close action and does not pop navigation or exit the exam.
- The modal copy of `Part4Table` does not receive `onReady`.

## Exam lifecycle contract

- Opening or closing the modal does not change navigation focus or AppState.
- Reading/preparation timers continue using their existing deadlines while hidden.
- Audio cue/player and answer recorder components stay mounted and are not restarted by the presentation
  change.
- A reading-to-question or Q8-to-Q9 transition may keep the modal open while the canonical table remains.
- Part 4 exit, submission, exam exit, screen replacement or unmount requests portrait restoration.
- Returning to portrait reveals the current phase and current remaining time; it does not restore a snapshot
  from before landscape entry.

## Native configuration contract

- Android/general app default remains portrait.
- iOS native initial orientation mask is portrait-up.
- iPhone and iPad declare portrait plus both landscape orientations as supported capabilities.
- iPad requires full-screen so runtime orientation locks are enforceable; Split View/Slide Over are excluded.
- Native configuration is expressed through `app.json` and config plugins, not edits to ignored generated
  `ios/` or `android/` files.

## Failure contract

- Unsupported landscape or a rejected lock leaves/reopens the usable portrait exam UI.
- No blank or permanently blocked modal remains after an error.
- Portrait restore failure re-enables the normal portrait notice so manual rotation remains a recovery path.
- Rapid taps and enter/close overlap produce at most one visible modal and finish with the latest requested
  state.
