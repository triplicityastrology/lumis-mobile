# Expo SDK 54 Upgrade

Date: 2026-07-20

## Scope

This upgrade moves the Lumis Expo app from SDK 53 to SDK 54 for compatibility
with the current iPhone Expo Go client. It does not intentionally change product
behavior or Dice interaction design.

The local device-test environment keeps `EXPO_PUBLIC_DICE_RITUAL=1` in the
ignored `apps/mobile/.env` file.

## Runtime Versions

- Expo: `54.0.36`
- React Native: `0.81.5`
- React: `19.1.0`
- React DOM: `19.1.0`
- React Native Web: `0.21.2`
- TypeScript: `5.9.3`
- Expo Metro runtime: `6.1.2`
- Expo Sensors: `15.0.8`
- Expo SecureStore: `15.0.8`
- Expo Crypto: `15.0.9`

Expo Crypto is included in Expo Go and supplies the Dice ritual with a
cross-platform cryptographically secure random source on iOS, Android, and web.

## Verification

- Expo Doctor: 18/18 checks passed.
- Expo dependency check: compatible SDK 54 versions installed.
- Workspace TypeScript typecheck: passed.
- Dice geometry, face-reading, settle, and 1,000-throw distribution fixtures:
  passed.
- Router, birth-date, birth-location, entitlement, billing, Care Circle, golden
  chart, profile, chat persistence, external sync, Worker, and mobile UI suites:
  passed.
- Production web export: passed.
- iOS Hermes development bundle: compiled successfully.
- Expo manifest reports `runtimeVersion: exposdk:54.0.0`.
- LAN server: `exp://192.168.0.106:8081`.

Physical-device launch and sensor behavior require manual iPhone verification.

## QA Regression Scope

1. Open the project in the current iPhone Expo Go and confirm there is no SDK
   incompatibility message, red screen, or startup crash.
2. Verify sign-in, magic-link return, session restore, sign-out/sign-in, saved
   profile, chart, and Past Reflections restoration.
3. Verify Talk, Insights, Dice, and You tab navigation, back behavior,
   notifications entry points, safe areas, status bar, icons, SVGs, and scrolling.
4. With `EXPO_PUBLIC_DICE_RITUAL=1`, run the full Dice flow: Ask, Ready/Mix,
   shake or tap, tumble, settle, result, and Reflect handoff.
5. Test iOS motion permission allowed and denied, accelerometer unavailable/error,
   shake threshold and debounce, tap fallback, Back during a roll, unmount cleanup,
   reduced motion, repeated rolls, and foreground/background transitions.
6. Confirm each die result matches its visible landed face, no die remains cocked,
   and repeated rolls do not freeze or crash.
7. Observe Dice animation performance and device temperature on a representative
   iPhone. Animation/design feedback belongs to Claude Fable; runtime crashes,
   permissions, sensors, and performance regressions belong to Technical.
8. Temporarily run with the feature flag disabled and confirm the existing Dice
   fallback remains available.
9. Smoke-test the web preview for startup, navigation, authentication screens,
   chart flow, Chat, Profile, and Dice tap fallback.

Android release testing remains out of scope for this iOS-first upgrade, although
the dependency set remains Android-compatible.
