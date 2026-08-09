# S2-T243 Founder Dice interactive offline route

This development-only route uses the real React Native Dice ritual. It is local,
deterministic, and makes zero provider calls, consumes zero units, and performs
zero persistence writes.

## Browser

Run `pnpm start:s2-t243-dice-gallery`, then open `http://localhost:8116`.
The external evidence strip must show the full 40-character commit and the
selected fixture. If normal Home/Auth, `INVALID_BUILD_MARKER`, or an Expo
loading frame appears, stop and do not capture.

Use the arrows above the product frame. The first four fixtures stop before any
roll. `interactive_en` and `interactive_zh` allow Ready, then the real throw
interaction; a deterministic local interpretation appears only after settling.
The remaining fixtures expose loading, successful, safety, fallback, malformed,
retry, unavailable, replay, and concurrent outcomes.

## Simulator

Boot the iPhone 17 Simulator, then run
`pnpm start:s2-t243-dice-simulator -- interactive_en`. Expo Go must already be
installed. Real AI, provider traffic, unit accounting, and persistence remain
disabled. Simulator evidence is not physical motion-sensor or production proof.

Result length, Persona treatment, and repeat-symbol wording remain
`inactive_unresolved`; the gallery does not select a product decision.
