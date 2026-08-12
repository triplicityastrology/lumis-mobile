import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const CONTROL_PATH = "config/s2-t322-real-dice-pre-roll-validation.json";
export const SEAL_PATH = "config/s2-t322-real-dice-pre-roll-validation-seal.json";
export const SEALED_FILES = Object.freeze([
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/features/dice/dicePreRollValidation.ts",
  "apps/mobile/src/features/dice/dicePreRollValidation.fixtures.ts",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "packages/shared/src/config/dice-question-boundary.ts",
  "config/s2-t317-final-dice-release-seal.json",
  "scripts/s2-t322-real-dice-pre-roll-validation-contract.mjs"
]);

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const fileHashes = () => Object.fromEntries(SEALED_FILES.map((path) => [path, sha256(readFileSync(path))]));
export const packageSha = (control, files) => sha256(`${JSON.stringify({ control, files })}\n`);

export function validateT322Package() {
  const control = readJson(CONTROL_PATH);
  const seal = readJson(SEAL_PATH);
  const files = fileHashes();
  if (control.schema !== "s2_t322_real_dice_pre_roll_validation_v1") throw new Error("STOP_S2_T322_CONTROL_INVALID");
  if (JSON.stringify(files) !== JSON.stringify(seal.files)) throw new Error("STOP_S2_T322_SOURCE_DRIFT");
  if (seal.package_sha256 !== packageSha(control, files)) throw new Error("STOP_S2_T322_PACKAGE_DRIFT");
  return Object.freeze({ control, seal });
}
