import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const source = read("supabase/functions/_shared/dice-v0-3-interpretation-contract.ts");
const canonical = read("supabase/functions/_shared/dice-synthetic-canonical-v1.ts");
const gateway = read("supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts");
const presentation = read("supabase/functions/_shared/dice-v0-3-presentation.ts");
const manifest = JSON.parse(read("config/dice-v0-3-source-provenance-manifest.json"));
const seal = JSON.parse(read("config/dice-v0-3-interpretation-contract-seal.json"));

for (const phrase of [
  "core/internal capability", "external environment, independent fortune/pace/distance", "never average with dignity",
  "No natal/birth/Persona/Knowledge Bank", "Level 3", "multi-throw",
  "Traditional Chinese written form", "question_reference", "synthesis",
  "timing_or_pace", "practical_direction", "CANTONESE_COLLOQUIAL", "GENERIC_BLOCK",
]) assert.match(source, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
for (const phrase of ["You drew", "Reading", "One thing to watch", "Practical step", "解讀", "需要留意", "實際一步"]) {
  assert.match(presentation, new RegExp(phrase));
}
assert.match(canonical, /buildDiceV03Prompt/);
assert.match(gateway, /parseCanonicalDiceOutput/);
assert.equal(manifest.schema, "lumis_dice_v0_3_source_provenance_manifest_v1");
assert.equal(manifest.status, "reviewed_distinct_supporting_artifacts_reconciled");
assert.notEqual(manifest.supporting_recovered_sources.markdown.sha256, manifest.supporting_recovered_sources.workbook.embedded_recovered_source_sha256);
assert.match(manifest.reconciliation.artifact_relationship, /separate reviewed supporting artifacts/);
assert.match(manifest.reconciliation.artifact_relationship, /not asserted to be byte-identical/);
assert.match(manifest.reconciliation.traffic_gate, /later release/);
assert.equal(seal.status, "source_only_default_off");
assert.equal(seal.prompt_version, "lumis_dice_v0_3_prompt_v2");
assert.equal(seal.result_schema, "lumis_dice_v0_3_result_v2");
assert.equal(seal.source_provenance_manifest_sha256, sha256("config/dice-v0-3-source-provenance-manifest.json"));
for (const [file, digest] of Object.entries(seal.files)) assert.equal(sha256(file), digest, `seal drift: ${file}`);
assert.equal(seal.runtime_boundary.browser_request_shape, "fixture_id_only_for_registry_or_private_founder_free_text_v1");
assert.match(seal.traffic_gate, /does not authorize deployment or traffic/);

console.log("Dice v0.3 quality/provenance contract checks passed (zero network / zero provider calls).");
