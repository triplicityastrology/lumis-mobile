import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const require = createRequire(import.meta.url);
const compiled = require(path.join(root, ".tmp/dice-synthetic-registry-tests/supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.js"));
const exported = compiled.exportDiceSyntheticRegistry();
const payload = {
  schema_version: exported.schema_version,
  registry_version: exported.registry_version,
  prompt_version: exported.prompt_version,
  technical_cases: exported.technical_cases,
  founder_slots: exported.founder_slots,
};
const checksum = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
assert(checksum === exported.registry_checksum, "STOP_S2_T248_REGISTRY_CHECKSUM_DRIFT");

const control = JSON.parse(readFileSync(path.join(root, "config/s2-t248-dice-fixture-registry.json"), "utf8"));
const schema = JSON.parse(readFileSync(path.join(root, "config/dice-synthetic-fixture-registry-export-v1.schema.json"), "utf8"));
const rubric = JSON.parse(readFileSync(path.join(root, "config/dice-founder-quality-rubric-v1.json"), "utf8"));
assert(control.registry_checksum === checksum && schema.properties.registry_checksum.const === checksum, "STOP_S2_T248_CONTROL_CHECKSUM_DRIFT");
assert(control.technical.total === 80 && control.technical.en === 40 && control.technical["zh-Hant"] === 40, "STOP_S2_T248_TECHNICAL_COUNT_DRIFT");
assert(control.founder_reserved.total === 40 && control.founder_reserved.en === 20 && control.founder_reserved["zh-Hant"] === 20, "STOP_S2_T248_FOUNDER_RESERVE_DRIFT");
assert(rubric.criteria.length === 10 && rubric.criteria.includes("astrological_sense") && rubric.criteria.includes("safety"), "STOP_S2_T248_RUBRIC_DRIFT");

const serverSource = readFileSync(path.join(root, "supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts"), "utf8");
const mobileSource = readFileSync(path.join(root, "apps/mobile/src/dev/FounderDiceFixtureRegistry.tsx"), "utf8");
const preparationSource = readFileSync(path.join(root, "apps/mobile/src/dev/diceFixturePreparation.ts"), "utf8");
const indexSource = readFileSync(path.join(root, "apps/mobile/index.ts"), "utf8");
for (const forbidden of ["fetch(", "supabase.from", "invoke(", "AZURE_", "provider_endpoint", "access_token", "service_role"]) {
  assert(!serverSource.includes(forbidden) && !mobileSource.includes(forbidden), `STOP_S2_T248_FORBIDDEN_PATH_${forbidden.replace(/\W/g, "_")}`);
}
assert(indexSource.includes('__DEV__ && process.env.EXPO_PUBLIC_DICE_FIXTURE_REGISTRY === "1"'), "STOP_S2_T248_DEV_GATE_MISSING");
assert(mobileSource.includes("developmentNoPersistence") && mobileSource.includes("developmentPreSubmitBoundary"), "STOP_S2_T248_ZERO_EFFECT_UI_GATE_MISSING");
assert(preparationSource.includes("FOUNDER_PRIVATE_DATA_REJECTED"), "STOP_S2_T248_PRIVATE_DATA_BOUNDARY_MISSING");
for (const accessibilityBoundary of [
  'accessibilityLabel="Synthetic Dice question"',
  'accessibilityRole="tab"',
  'accessibilityRole="button"',
  'accessibilityLiveRegion="polite"',
  "KeyboardAvoidingView",
]) {
  assert(mobileSource.includes(accessibilityBoundary), `STOP_S2_T248_ACCESSIBILITY_BOUNDARY_${accessibilityBoundary.replace(/\W/g, "_")}`);
}

console.log(`S2_T248_DICE_FIXTURE_REGISTRY_OK checksum=${checksum} technical=80 founder_reserved=40`);

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
