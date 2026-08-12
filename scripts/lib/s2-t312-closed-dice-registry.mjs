import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const CONTROL_PATH = "config/s2-t312-closed-dice-registry.json";
export const SEAL_PATH = "config/s2-t312-closed-dice-registry-seal.json";
export const SEALED_FILES = Object.freeze([
  "apps/mobile/src/dev/founderDiceQuestionBank.ts",
  "apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/screens/LumisDiceScreen.tsx",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.fixtures.ts",
  "config/s2-t302-dice-live-result-adapter.json",
  "config/s2-t307-dice-release-candidate.json",
  "config/s2-t307-dice-release-candidate-seal.json",
  "scripts/s2-t302-dice-live-result-adapter-contract.mjs",
  "scripts/s2-t307-dice-release-contract.mjs"
]);

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const fileHashes = () => Object.fromEntries(SEALED_FILES.map((path) => [path, sha256(readFileSync(path))]));
export const packageSha = (control, files) => sha256(`${JSON.stringify({ control, files })}\n`);
