# Claude Fable Preservation Inventory

Date: 2026-07-21  
Audience: Codex Technical, QA, PM, Claude Fable  
Sources: `AC-QA-03` Dice handoff and `AC-QA-04` Navigation/Layout/Rebrand handoff

## Purpose

This is the regression-preservation list for Technical work. Refactors, backend
integration, navigation changes, Expo upgrades, and merge conflict resolution
must preserve the user-visible behavior and product rules below unless PM or
Claude Fable explicitly replaces them.

This document does **not** declare every item production-ready. Items under
"Open QA or Technical work" may be changed to fix known gaps while preserving
the intended design and behavior.

## Protected Claude implementation

### Native app shell and visual identity

- Native Expo React Native implementation; do not replace it with a WebView of
  the Claude web prototype.
- Lumis navy/gold celestial presentation, including the star field, glows,
  horizon treatment, shooting-star treatment, and reduced-motion behavior.
- Shared `CelestialBackground` component and its memoization/performance intent.
- `SafeAreaProvider` with `initialWindowMetrics` at the app root.
- Four persistent main destinations and labels:
  - Talk
  - Insights
  - Dice
  - You
- Tab-bar design in which the background reaches the physical bottom and the
  icons/labels remain above the real bottom inset.

### Splash and Welcome

- `LumisSplashScreen` is the first cold-launch visual.
- Splash includes the celestial sky, double-ring mark, orbiting dot, serif sun,
  Lumis wordmark, and slogan.
- Splash auto-advances at about four seconds and supports tap-to-skip.
- Welcome uses the Lumis sky rather than a flat background.
- Welcome primary CTA uses the sunrise-to-sunset gradient rather than flat gold.

### Navigation and return behavior

- Visible Back from Care Circle returns to You/Profile.
- Visible Back from Plans returns to You/Profile.
- Visible Back from Birth Details returns to You/Profile.
- Notifications remember the opening surface so Back returns to Chat, Insights,
  Dice, You/Profile, or Home as appropriate.
- Safe-area initialization should not create a first-frame jump or "kick".

### Chat and Past Reflections

- Chat has no chart-context/banner card between the header and messages.
- The Persona line under the Lumis name is a tappable pill that opens Insights.
- Chat header includes:
  - Back
  - Persona identity
  - Past Reflections
  - Start a new topic (`+`)
  - Notifications
- New-topic behavior must preserve the prior saved conversation and create only
  one new thread on the first successful send.
- User-facing conversation history remains **Past Reflections**, never
  `Chat History`.
- Claude intentionally left asymmetric chat-bubble corners and the composer send
  button inset/pill polish for a later visual pass.

### Generating and Birth Details

- Chart Generating retains the celestial sky and chart-generation progress
  presentation.
- Birth Details uses native date/calendar and time controls under the sky design.
- Future-date rejection and unknown-time flow must remain intact.
- Unknown time must not expose ASC, MC, houses, planet-house placements, or AI
  claims derived from them.

### Feature-flagged Dice ritual

- The new ritual remains behind `EXPO_PUBLIC_DICE_RITUAL=1` until QA/PM approves
  default-on; the older `LumisDiceScreen` remains the fallback.
- Preserve the ritual state model:
  - IDLE
  - READY
  - MIXING
  - THROW
  - TUMBLE
  - SETTLE
  - RESULT
  - INTERPRET / placeholder interpretation
- Preserve question entry and the no-question fallback:
  `What should I notice right now?`
- Preserve shake-to-mix, upward-flick throw, timed tap fallback, settled-face
  reveal, result card, repeat throw, subtle haptics, reduced-motion path, and
  accessibility announcements.
- Preserve the physics/RNG ownership rule: the app determines the landed planet,
  sign, and house; AI must never redraw or replace those symbols.
- Preserve geometry/face-reading/cocked/settle/distribution test coverage,
  including 12 faces, 20 vertices, the tilt thresholds, and the seeded
  1,000-throw distribution test.
- Preserve planet/sign/house dice, nodes, no Chiron, and Arabic-number house faces.
- Preserve the landed symbols unchanged when handing the result to Chat.

### Dice history and interpretation foundations

- Preserve the Past Rolls sheet, search/read-only detail intent, and signed-in
  persistence service/migration foundation (`dice_throws`, migration `0019`).
- Preserve owner-only RLS intent and local/no-backend graceful degradation.
- Preserve `source = dice_tab` for Dice-tab throws and the future `chat` source.
- Preserve null `interpretation_message_id` before backend interpretation and
  link it only after the eventual interpretation message exists.
- Preserve the interpretation bank and classical dignity/house attribute data,
  including the encoded Level 2 examples and no classical fortune judgment for
  outer planets.

## Protected product and copy rules

- Dice throwing itself is free; the eventual `route.dice` interpretation costs
  **5 credits**.
- Credit copy stays limited to approved Profile/Paywall surfaces.
- UI is English-primary for current UAT.
- Traditional Chinese reference/output must use standard written Chinese
  (`書面語`), not Cantonese colloquial particles.
- Dice interpretation is reflective, not deterministic fortune-telling.
- Judgment questions may use the approved classical favorable/challenging layer;
  descriptive questions must not receive a favorable/unfavorable verdict.
- Avoid casino/gambling styling and language.
- Do not reintroduce `3 credits`, `3 units`, `Star Buddy`, `Astro` as the product
  name, `Chat History`, or other superseded terminology.
- The future AI route must acknowledge the exact throw, connect all three symbols
  to the question, include one watch-out, give one practical direction, and
  invite continuation without changing the dice.

## Open QA or Technical work — do not treat as protected defects

Technical may change implementation in these areas, but must preserve the
intended behavior above:

- Fix Chat safe-area ownership so the parent and tab bar do not both apply the
  bottom inset.
- Add production-grade system Back/navigation behavior for Android hardware Back
  and iOS swipe/gesture navigation.
- Ensure the celestial background does not visibly restart when conditional
  screens unmount/remount; `React.memo` alone does not guarantee this.
- Coordinate Splash timing with restored-account loading so the final route is
  deterministic and Welcome does not flash incorrectly.
- Update and keep `test:mobile-ui` aligned with the notification-return helper.
- Run real-iPhone safe-area, restored-session, reduced-motion, notification,
  picker, and navigation tests.
- Confirm whether accelerometer-only Dice gestures are approved or add the
  gyroscope behavior required by the current motion specification.
- Add Dice foreground/background lifecycle handling.
- Complete Past Rolls deletion UI and visible persistence failure/retry handling.
- Harden/deploy migration `0019`, then run owner/cross-user RLS and real
  persistence tests.
- Implement real `route.dice` AI interpretation, atomic charging, entitlement,
  idempotency, streaming, and `interpretation_message_id` linkage.
- Complete founder content approval and real-device performance/motion UAT before
  enabling the ritual by default.
- Finish the intentionally deferred chat bubble/composer visual polish.

## Technical merge checklist

Before Technical commits a refactor touching `App.tsx`, app navigation,
`CelestialBackground`, Chat, main tabs, Birth Details, or `features/dice`:

- Compare the diff against this inventory.
- Run `pnpm -r typecheck`.
- Run `pnpm test:mobile-ui`.
- Run `pnpm test:dice`.
- Run `pnpm test:route-credits` when Dice/chat billing or routing is touched.
- Run a production Expo export.
- Test both values of `EXPO_PUBLIC_DICE_RITUAL`.
- Record any intentionally replaced Claude behavior in the commit/PM tracker.
- Do not resolve merge conflicts by taking an entire Technical or Claude version
  of `App.tsx`; reconcile behavior item by item.

