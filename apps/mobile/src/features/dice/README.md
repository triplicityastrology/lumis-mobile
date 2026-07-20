# Dice ritual module

Physics-true astro dice (AC-DICE-01 v1.3 build spec + AC-DICE-04 v1.2 animation
package in Drive `06_Dice_Mini_Game/`). Feature-flagged; `LumisDiceScreen`
remains the identical-flow fallback.

## Enable

Set `EXPO_PUBLIC_DICE_RITUAL=1` in the build environment. Flag lives in
`featureFlag.ts`; the switch is in `App.tsx` at the `screen === "dice"` branch.

## Layout

| File | Role |
|---|---|
| `math.ts` | vec3/quaternion helpers (pure) |
| `geometry.ts` | dodecahedron — face normals are cyclic perms of (0, ±φ, ±1); getting this wrong folds the pentagons |
| `rng.ts` | CSPRNG (throws if `crypto.getRandomValues` is missing) + seeded PRNG for tests only |
| `faceReading.ts` | pure top-face reader, cocked below 0.90 dot (spec §5) |
| `physics.ts` | 3-dice rigid-body sim: velocity-dependent restitution (settle-calm), resting-contact mode (no torque regeneration), walls, nudge + micro-snap resolution |
| `constants.ts` | confirmed face sets (nodes, Arabic house numerals) + `DICE_TIMINGS` — the single tuning surface |
| `useMotionGestures.ts` | shake/flick from expo-sensors, gravity-compensated up, 500 ms debounce; thresholds in `MOTION_TUNING` for the beta calibration overlay |
| `DiceRitualScreen.tsx` | the staged ritual (IDLE→INTERPRET) rendered with react-native-svg painters |
| `dice.fixtures.ts` | acceptance fixtures — see below |

## Tests

```
pnpm test:dice
```

Compiles with `apps/mobile/tsconfig.dice-test.json` and runs in Node. Covers the
spec §9 acceptance criteria that are testable off-device: pentagon/coplanarity
geometry, exact face reading (12 faces × spins), cocked threshold both sides,
settle inside the 1.5–3 s window, and the 1,000-throw distribution test
(every face of every die within 5–12%; cocked resolves ≤ 3 nudges).

## Device spike still to verify (the go/no-go)

- 60 fps through TUMBLE on the mid-range test device with the SVG painter
  renderer. If it can't hold, swap the view layer to react-three-fiber +
  expo-gl — sim/face-reading/flow stay unchanged.
- Real-device shake/flick feel → tune `MOTION_TUNING`, ship the medians.
- Haptics: add `expo-haptics`, wire per `DICE_TIMINGS` moments (light ticks in
  MIXING ≤ 8/s, 3 medium first-contacts in TUMBLE, soft success at RESULT).
- iOS motion-permission denial path → tap-throw immediately (currently the tap
  button appears after 6 s regardless).

## Later integration (out of module scope)

Interpretation via chat `route.dice` (5 credits at interpretation time),
`dice_throws` persistence, Past Reflections rows (mini glyph triple).
