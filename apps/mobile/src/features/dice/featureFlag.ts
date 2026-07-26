/**
 * Feature flag for the physics-true Dice ritual (AC-DICE-01 §4).
 *
 * DEFAULT: ENABLED. The physics Dice ritual (`DiceRitualScreen` — hand cradle,
 * shake / flick-to-throw, three coloured resin dice, "Astrology Dice" title,
 * bilingual question field, Ready CTA) is the founder-approved, active Dice
 * experience and needs NO launch flag. This is what ships on the founder's phone.
 *
 * The pre-rendered `LumisDiceScreen` (2D fallback, identical flow and fairness)
 * is retained ONLY for the device-performance spike and is now opt-OUT: set
 * `EXPO_PUBLIC_DICE_RITUAL=0` in the build environment to use it. Any other value
 * (or unset — the normal local/device case) yields the approved physics ritual.
 *
 * Previously this was opt-IN (`=== "1"`), which meant normal Expo Go testing —
 * with no env var set — fell back to the 2D screen; that is why the founder saw
 * the wrong Dice screen (S1-DICE-P1).
 */
export const DICE_RITUAL_ENABLED = process.env.EXPO_PUBLIC_DICE_RITUAL !== "0";
