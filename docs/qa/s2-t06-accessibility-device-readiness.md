# S2-T06 Accessibility And Device Evidence Readiness

Status: source audit complete; physical-device evidence pending.

No device evidence is claimed by this document. It is a founder/QA execution
matrix for a later authorized iPhone and Android pass.

## Source Findings

### Repaired

- Auth email entry now has an explicit label, email semantics, Send keyboard
  action, polite success announcement, and button roles for recovery actions.
- Onboarding validation is assertively announced on every step.
- Unknown birth time is exposed as a checked checkbox during onboarding and as
  a checked switch when editing saved birth details.
- Birthplace choices expose radio/selected state.
- Shared flow and state headers expose heading semantics; shared Back controls
  expose button semantics.
- Birth-detail picker and regeneration-confirmation surfaces identify
  themselves as modal accessibility contexts.
- Both active Dice question inputs have explicit labels. Legacy Dice result
  actions now expose button roles; physics Dice already uses shared accessible
  buttons and foreground-aware Dynamic Type measurement.

### Already Protected; No Source Change

- Auth resend and logout errors use assertive live regions; logout confirmation
  is modal and exposes busy/cancel semantics.
- Persona choices expose radio/selected state.
- App-level Android hardware Back follows contextual return state rather than
  resetting every route to Home.
- Care Circle and Notifications release screens remain static previews. Their
  preview and empty-state text is grouped for screen-reader output.
- Physics Dice listens for font-scale changes and app foreground return, then
  stacks result actions at accessibility text sizes.
- Scrollable high-traffic flows use explicit safe-area ownership and disable
  automatic content inset adjustment.

## Evidence Header

Record before each run:

- Git commit;
- iPhone model and iOS version;
- Android model and Android version;
- Expo Go or installed build version;
- app language;
- text-size setting;
- VoiceOver or TalkBack enabled/disabled;
- portrait/landscape;
- date, tester initials, and result.

Store screenshots/video with neutral filenames. Redact email addresses, birth
details, chart data, reflection text, callback URLs, tokens, and account IDs.

## Test Matrix

### 1. Auth Keyboard, Focus, And Errors

Path:

1. Signed-out Home → `Sign in`.
2. Focus `Email address`.
3. Enter an invalid address and use the keyboard Send action.
4. Correct the address.
5. Open the logout dialog only from a signed-in disposable account.

Expected:

- screen reader announces the field as Email address;
- email keyboard and Send action are available;
- invalid-email text is announced once as an alert;
- focus remains usable after the error appears;
- Cancel returns to the signed-in screen without changing session;
- no raw transport/provider text is spoken.

### 2. Onboarding → Chart Preview → Persona → Back

Path:

1. Confirmed-empty disposable account → chart setup.
2. Date step → Time step → Place step → chart preview.
3. Continue to Persona.
4. Select an avatar/style, then use Back.

Expected:

- headings and Back buttons are announced;
- each error is announced and focus order remains visual order;
- unknown-time checkbox announces checked state and disables birth time;
- birthplace choices announce radio selection;
- Persona choices announce selected state;
- Back returns to chart preview without a dead end or duplicate submission.

### 3. Android Hardware Back

Test hardware Back from:

- Auth;
- each onboarding step;
- chart preview;
- Persona;
- Profile → Birth Details;
- Profile → Care Circle preview;
- Profile → Notifications preview;
- Talk → Past Reflections;
- Dice result/history.

Expected: immediate previous in-app context is restored. Bottom-tab selection
alone does not create fake Back history. Direct-entry fallback is Home or the
documented account screen, never a blank view.

### 4. VoiceOver And TalkBack

On both platforms verify:

- title before body before form controls;
- buttons, tabs, radios, checkbox, switch, and disabled/busy states;
- alert and status announcements occur once;
- decorative celestial, chart, and motif art does not interrupt focus order;
- modals trap accessibility focus until Cancel/Done;
- no hidden prototype control is reachable.

### 5. Care Circle And Notifications Static Previews

Path: Profile → Care Circle; each main surface → Notifications.

Expected:

- Back and screen heading are announced;
- preview/not-active status and safety boundary are understandable;
- no linking, code, check-in, reminder, permission, delivery, or notification
  action is focusable.

### 6. Dice At Normal And Largest Text

Run both active implementations if the fallback build is explicitly selected;
normal founder QA uses default physics Dice.

Path:

1. Dice → question field → validation.
2. Enter a question → roll → result.
3. Test `Roll again` and `Reflect in Chat`.
4. Repeat at the largest accessibility text setting, returning from Settings
   while Lumis remains open.

Expected:

- question and validation are announced;
- normal text keeps horizontal actions with Reflect wider;
- largest accessibility text stacks actions vertically after foreground;
- both full labels remain readable and tappable;
- physics, history, question clearing, and Chat handoff remain unchanged.

## Remaining Device-Only Evidence

- actual VoiceOver/TalkBack pronunciation and rotor order;
- keyboard dismissal and focus retention on both platforms;
- modal focus trapping by Expo Go/native runtime;
- Android manufacturer-specific Back behavior;
- largest-text layout on supported iPhone and Android widths;
- reduced-motion behavior alongside screen readers.
