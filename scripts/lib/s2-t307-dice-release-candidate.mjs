import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const CONTROL_PATH = "config/s2-t307-dice-release-candidate.json";
export const SEAL_PATH = "config/s2-t307-dice-release-candidate-seal.json";
export const SEALED_FILES = Object.freeze([
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/screens/LumisDiceScreen.tsx",
  "apps/mobile/src/services/diceLiveResultAdapter.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.fixtures.ts",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "apps/mobile/src/dev/founderDiceQuestionBank.ts",
  "apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx",
  "config/s2-t302-dice-live-result-adapter.json",
  "scripts/s2-t302-dice-live-result-adapter-contract.mjs",
  "config/evidence/s2-t263-azure-foundry-pricing-sanitized-v1.json",
  "config/evidence/s2-t272-dice-runtime-proof.json",
  "config/evidence/s2-t307-dice-deno-check.json",
  "config/s2-t303-dice-default-off-final-control.json",
  "config/s2-t303-dice-default-off-final-package-seal.json",
  "config/s2-t304-dice-80-results.json",
  "config/s2-t304-dice-80-results-manifest.json",
  "scripts/lib/s2-t303-dice-default-off-final.mjs",
  "scripts/lib/s2-t304-dice-80-results.mjs",
  "scripts/run-s2-t303-dice-default-off-deployment.zsh",
  "scripts/s2-t304-dice-80-results.mjs",
  "scripts/s2-t304-dice-80-results-emulator.mjs",
  "supabase/functions/_shared/dice-synthetic-canonical-v1.ts",
  "supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts",
  "supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/dice-tokenizer-v1.ts",
  "supabase/functions/dice-synthetic/deno.json",
  "supabase/functions/dice-synthetic/index.ts",
  "supabase/tests/s2-t247-dice-interpretation-response-v0-3.schema.json"
]);

export class T307Stop extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function fileHashes() {
  return Object.fromEntries(SEALED_FILES.map((path) => [path, sha256(readFileSync(path))]));
}

export function packageSha(control, hashes) {
  return sha256(`${JSON.stringify({ control, files: hashes })}\n`);
}

export function currentHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export function verifyRelease({ requireClean = true } = {}) {
  const control = readJson(CONTROL_PATH);
  const seal = readJson(SEAL_PATH);
  const hashes = fileHashes();
  if (JSON.stringify(seal.files) !== JSON.stringify(hashes)) throw new T307Stop("STOP_S2_T307_SOURCE_DRIFT");
  if (seal.package_sha256 !== packageSha(control, hashes)) throw new T307Stop("STOP_S2_T307_PACKAGE_DRIFT");
  for (const authority of Object.values(control.authorities)) {
    try { execFileSync("git", ["merge-base", "--is-ancestor", authority, "HEAD"], { stdio: "ignore" }); }
    catch { throw new T307Stop("STOP_S2_T307_AUTHORITY_ANCESTRY"); }
  }
  const screen = control.protected_dice_ui["apps/mobile/src/features/dice/DiceRitualScreen.tsx"];
  const lumis = control.protected_dice_ui["apps/mobile/src/screens/LumisDiceScreen.tsx"];
  if (hashes["apps/mobile/src/features/dice/DiceRitualScreen.tsx"] !== screen.sha256 || hashes["apps/mobile/src/screens/LumisDiceScreen.tsx"] !== lumis.sha256) {
    throw new T307Stop("STOP_S2_T307_PROTECTED_DICE_UI_DRIFT");
  }
  if (requireClean) {
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" });
    if (status !== "") throw new T307Stop("STOP_S2_T307_TRACKED_TREE_DIRTY");
  }
  return { control, seal, head: currentHead() };
}
