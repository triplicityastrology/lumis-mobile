import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "1bf07f1769d67777792cfa3b27d150e738339a02";
const read = (path) => readFileSync(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(read("config/s2-t302-dice-live-result-adapter.json"));
const adapter = read("apps/mobile/src/services/diceLiveResultAdapter.ts");
const workbench = read("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx");
const launcher = read("scripts/start-s2-t302-dice-live-result-expo.sh");
const registry = read("apps/mobile/src/services/diceFounderFixtureRegistry.ts");

for (const [path, expected] of Object.entries(manifest.protected_product_sources)) {
  const current = read(path);
  if (path.endsWith("DiceRitualScreen.tsx")) {
    for (const invariant of ["Roll again", "Reflect in Chat", "DiceInterpretationCard", "buildReflectionPrompt"]) {
      assert(current.includes(invariant), `Dice visual/behavior invariant missing: ${invariant}`);
    }
    continue;
  }
  const base = execFileSync("git", ["show", `${BASE}:${path}`]);
  const blob = execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();
  assert.deepEqual(Buffer.from(current), base, `${path} must remain byte-identical`);
  assert.equal(blob, expected.git_blob, `${path} git blob drifted`);
  assert.equal(sha256(current), expected.sha256, `${path} SHA-256 drifted`);
}

assert.match(adapter, /ai_enabled: boolean/);
assert.match(adapter, /traffic_authorized: boolean/);
assert.match(adapter, /isAcceptedAuthority/);
assert.match(adapter, /create_gateway_transport\?\.\(\)/);
assert.match(adapter, /Object\.keys\(value\)\.some/);
assert.match(adapter, /fixture_id/);
assert.match(adapter, /resolveDiceFounderFixture/);
assert.doesNotMatch(adapter, /\^dice-founder-\(\?:en\|zh\)-\\d/);
assert.match(adapter, /fixture\.exact_text !== request\.question/);
assert.match(registry, /a6f2700b5b689bc00a130bde083e2efbce1a83ac64df8ddaee5565b2f2e9d211/);
assert.doesNotMatch(adapter, /fetch\(|supabase|azure|endpoint|bearer|api[_-]?key|provider[_-]?(?:request|response)/i);
assert.match(workbench, /createDiceFounderProductBridge/);
assert.match(workbench, /ai_enabled: false, traffic_authorized: false, authority: null/);
assert.match(workbench, /result stays on Dice/);
assert.equal(manifest.mobile_request_fields.join(","), "fixture_id");
assert.equal(manifest.founder_fixture_registry.membership, "exact_40_item_lookup");
assert.equal(manifest.founder_fixture_registry.question_binding, "exact_text");
assert.equal(manifest.provider_calls_default, 0);
assert.equal(manifest.remote_calls, 0);
assert.equal(manifest.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.match(launcher, /codex\/s2-t302-dice-live-result-adapter/);
assert.match(launcher, /8174/);
assert.match(launcher, /EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E=1/);
assert.match(launcher, /live_adapter=disabled provider_calls=0 units=0 persistence=0/);
assert.doesNotMatch(launcher, /kill -9|pkill|killall|pnpm install/);

const bankFixture = read("apps/mobile/src/dev/founderDiceQuestionBank.fixtures.ts");
assert.match(bankFixture, /FOUNDER_EXCLUDED_ZH_AUTHORING_ID === "ZH04"/);
assert.match(bankFixture, /ZH08/);
assert.match(bankFixture, /ZH09/);

console.log("S2-T302 Dice live-result adapter source contract passed");
