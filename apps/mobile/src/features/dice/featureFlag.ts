/**
 * Feature flag for the physics-true Dice ritual (AC-DICE-01 §4: the whole module
 * ships behind a flag; the pre-rendered LumisDiceScreen remains the fallback path
 * with identical flow and fairness).
 *
 * Enable by setting EXPO_PUBLIC_DICE_RITUAL=1 in the build environment.
 */
export const DICE_RITUAL_ENABLED = process.env.EXPO_PUBLIC_DICE_RITUAL === "1";
