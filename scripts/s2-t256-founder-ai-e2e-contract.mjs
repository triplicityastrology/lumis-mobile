import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const entry = read("apps/mobile/index.ts");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const boundary = read("apps/mobile/src/dev/founderAiReviewContract.ts");
const launcher = read("scripts/start-s2-t256-founder-ai-review-web.sh");
const simulator = read("scripts/start-s2-t256-founder-ai-review-simulator.sh");
const control = JSON.parse(read("supabase/tests/s2-t256-founder-ai-review-control.json"));
const recordSchema = JSON.parse(read("supabase/tests/s2-t256-founder-ai-review-interface.schema.json"));
const verdictSchema = JSON.parse(read("supabase/tests/s2-t256-founder-verdict.schema.json"));
const fixtureExportSchema = JSON.parse(read("supabase/tests/s2-t256-founder-fixture-export.schema.json"));
const evidenceSchema = JSON.parse(read("supabase/tests/s2-t256-gateway-evidence.schema.json"));

assert.match(entry, /__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_FOUNDER_AI_REVIEW_CONSOLE === "1"/);
assert.match(entry, /createElement\(FounderAiQualityReviewConsole\)/);
assert.match(entry, /createElement\(App\)/);
assert.match(consoleSource, /Synthetic evidence only/);
assert.match(consoleSource, /Dice/);
assert.match(consoleSource, /Companion \/ Chat/);
assert.match(consoleSource, /Prepare checksum package/);
assert.match(consoleSource, /Prepare Founder questions/);
assert.match(consoleSource, /Freeze next slot/);
assert.match(consoleSource, /NO_NORMAL_CHAT_INTEGRATION_AUTHORITY/);
assert.match(consoleSource, /CryptoDigestAlgorithm\.SHA256/);
assert.match(consoleSource, /accessibilityLiveRegion="polite"/);
assert.match(boundary, /Array\.from\(\{ length: 20 \}/g);
assert.match(boundary, /DICE-FOUNDER-EN-/);
assert.match(boundary, /DICE-FOUNDER-ZH-/);
assert.match(boundary, /validateFounderDiceDraft/);
assert.match(boundary, /parseClosedGatewayEvidence/);
assert.equal(control.dice_founder_reserve.total, 40);
assert.equal(control.dice_founder_reserve.en, 20);
assert.equal(control.dice_founder_reserve.zh_Hant, 20);
assert.deepEqual(control.effects, { azure_calls: 0, provider_calls: 0, units: 0, member_persistence: 0 });
assert.equal(control.traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(recordSchema.additionalProperties, false);
assert.equal(verdictSchema.additionalProperties, false);
assert.equal(fixtureExportSchema.additionalProperties, false);
assert.equal(evidenceSchema.additionalProperties, false);
assert.equal(fixtureExportSchema.properties.payload.properties.fixtures.maxItems, 40);
assert.equal(evidenceSchema.properties.effects.properties.persistence_writes.const, 0);
assert.equal(evidenceSchema.properties.effects.properties.units_charged.const, 0);
assert.equal(control.gateway_interfaces.dice, "dice_interpretation_response_v0_3");
assert.equal(control.gateway_interfaces.companion_chat, "chat_synthetic_response_v1");
assert.equal(control.companion_chat.enabled, false);
for (const source of [consoleSource, boundary, entry]) {
  assert.doesNotMatch(source, /fetch\s*\(|createClient\s*\(|supabase\.from|AsyncStorage|SecureStore|LUMIS_AI_ENABLED|AZURE_/i);
}
assert.match(launcher, /expo export --platform web --dev --clear/);
assert.match(launcher, /FOUNDER_AI_REVIEW_HEAD/);
assert.match(launcher, /FOUNDER_AI_REVIEW_STATE/);
assert.match(launcher, /NO_NORMAL_CHAT_INTEGRATION_AUTHORITY/);
assert.match(launcher, /grep -RFl/);
assert.match(simulator, /FOUNDER_AI_REVIEW_HEAD/);
assert.doesNotMatch(`${launcher}\n${simulator}`, /kill\s|pkill|killall|pnpm install|npm install/);
for (const forbidden of ["account_id", "device_id", "raw_prompt", "raw_response", "endpoint", "credential"]) {
  assert.ok(control.prohibited.includes(forbidden));
}
console.log("S2-T256 Founder AI end-to-end console source contract passed");
