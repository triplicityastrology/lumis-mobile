import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const MANIFEST_PATH = "config/s2-t317-final-dice-release.json";
export const SEAL_PATH = "config/s2-t317-final-dice-release-seal.json";

export const SEALED_FILES = Object.freeze([
  "apps/mobile/src/dev/founderDiceQuestionBank.ts",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/features/dice/dicePreRollValidation.ts",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.ts",
  "apps/mobile/src/services/diceFounderProductBridge.ts",
  "config/s2-t307-dice-release-candidate-seal.json",
  "config/s2-t312-closed-dice-registry-seal.json",
  "config/s2-t313-founder-signer-trust-anchor.json",
  "config/s2-t314-final-disabled-deploy-package-seal.json",
  "config/s2-t315-authorization-day-package-seal.json",
  "scripts/run-s2-t314-final-disabled-deploy.zsh",
  "scripts/run-s2-t315-migration-0039.sh",
  "scripts/run-s2-t315-technical-80.sh",
  "supabase/functions/dice-synthetic/index.ts",
  "supabase/functions/_shared/dice-tokenizer-v1.ts",
]);

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function sealedFileHashes() {
  return Object.fromEntries(SEALED_FILES.map((path) => [path, sha256(readFileSync(path))]));
}

export function packageSha256(manifest, files) {
  return sha256(`${JSON.stringify({ manifest, files })}\n`);
}

export function validateRelease() {
  const manifest = readJson(MANIFEST_PATH);
  const seal = readJson(SEAL_PATH);
  const files = sealedFileHashes();
  if (manifest.schema !== "s2_t317_final_dice_release_v1") throw new Error("STOP_S2_T317_MANIFEST_INVALID");
  if (JSON.stringify(files) !== JSON.stringify(seal.files)) throw new Error("STOP_S2_T317_SOURCE_DRIFT");
  if (seal.package_sha256 !== packageSha256(manifest, files)) throw new Error("STOP_S2_T317_PACKAGE_DRIFT");
  return Object.freeze({ manifest, seal });
}
