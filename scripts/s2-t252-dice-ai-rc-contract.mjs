import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const control = JSON.parse(read("config/s2-t252-dice-ai-release-candidate.json"));
const ritual = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const history = read("apps/mobile/src/features/dice/DiceHistorySheet.tsx");
const endpoint = read("supabase/functions/dice-synthetic/index.ts");
const registry = read("supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts");
const adapter = read("supabase/functions/_shared/dice-synthetic-registry-adapter-v0-3.ts");

assert.deepEqual(control.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(control.mode, "source_only_default_off_zero_traffic");
assert.deepEqual(control.registry, {
  technical: 80,
  founder_reserved: 40,
  en_total: 60,
  zh_hant_total: 60,
  checksum: "43cccc009f15a43c1801bd090234540e474a6cb20a1a48aa3a3bcd9b86a1a030",
});
assert.deepEqual(control.founder_effects, {
  provider_calls: 0,
  units_charged: 0,
  persistence_writes: 0,
  session_history_collections: 0,
  remote_history_reads: 0,
  remote_history_deletes: 0,
});
assert.match(ritual, /!developmentNoPersistence \? \([\s\S]{0,180}accessibilityLabel="Past rolls"/);
assert.match(ritual, /if \(!developmentNoPersistence\) \{[\s\S]{0,260}sessionRollsRef\.current =/);
assert.match(ritual, /!developmentNoPersistence && historyOpen \? \([\s\S]{0,160}<DiceHistorySheet/);
assert.doesNotMatch(history, /developmentNoPersistence/);
assert.match(endpoint, /reviewedDiceSyntheticRegistry/);
assert.match(adapter, /DICE_TECHNICAL_FIXTURES\.map/);
assert.match(registry, /DICE_TECHNICAL_FIXTURES/);
assert.match(registry, /DICE_FOUNDER_RESERVED_SLOTS/);

for (const [path, expected] of Object.entries(control.source_hashes)) {
  assert.match(expected, /^[a-f0-9]{64}$/, `${path} must have a sealed SHA-256`);
  const actual = createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
  assert.equal(actual, expected, `source drift: ${path}`);
}

console.log("S2_T252_DICE_AI_RELEASE_CANDIDATE_OK traffic=0 deployment=false");
