import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const screen = read("apps/mobile/src/dev/FounderCompanionChatJourney.tsx");
const boundary = read("apps/mobile/src/dev/founderCompanionChatWindowContract.ts");
const entry = read("apps/mobile/index.ts");
const web = read("scripts/start-s2-t281-founder-chat-web.sh");
const simulator = read("scripts/start-s2-t281-founder-chat-simulator.sh");
const control = JSON.parse(read("supabase/tests/s2-t271-founder-chat-window-control.json"));
const evidenceSchema = JSON.parse(read("supabase/tests/s2-t271-founder-chat-window-execution-evidence.schema.json"));
const verdictSchema = JSON.parse(read("supabase/tests/s2-t271-founder-chat-window-verdict.schema.json"));

assert.match(entry, /__DEV__\s*&&\s*process\.env\.EXPO_PUBLIC_FOUNDER_COMPANION_CHAT === "1"/);
assert.match(screen, /Founder test window/);
assert.match(screen, /Companion/);
assert.match(screen, /Normal Chat/);
assert.match(screen, /Import accepted Dice evidence/);
assert.match(screen, /Runtime accepts only fixture_id/);
assert.match(screen, /Prove disabled and export verdict/);
assert.match(screen, /accessibilityLiveRegion="polite" accessibilityRole="text"/);
assert.match(screen, /keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"/);
assert.match(screen, /CelestialBackground/);
assert.match(boundary, /ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_CHAT_WINDOW_AUTHORIZATION_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256: string \| null = null/);
assert.match(boundary, /ACCEPTED_POST_WINDOW_DISABLED_PROOF_SHA256: string \| null = null/);
assert.match(boundary, /createAuthorizedFixtureInvocation/);
assert.match(boundary, /exactKeys\(input, \["fixture_id"\]/);
assert.match(boundary, /FINAL_DICE_RUNTIME_COMMIT/);
assert.match(boundary, /DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY/);
assert.deepEqual(control.fixture_sets, { companion: 30, normal_chat: 30, en: 30, zh_hant: 30 });
assert.deepEqual(control.embedded_states, ["offline_preview", "not_yet_run"]);
assert.deepEqual(control.effects, { provider_calls: 0, persistence_writes: 0, units_charged: 0, member_data: false });
assert.deepEqual(control.statuses, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(evidenceSchema.additionalProperties, false);
assert.equal(evidenceSchema.properties.response.additionalProperties, false);
assert.equal(evidenceSchema.properties.response.properties.state.const, "live_synthetic");
assert.equal(verdictSchema.properties.payload.additionalProperties, false);
assert.match(web, /PORT="\$\{FOUNDER_CHAT_WINDOW_WEB_PORT:-8151\}"/);
assert.match(simulator, /PORT="\$\{FOUNDER_CHAT_WINDOW_SIMULATOR_PORT:-8152\}"/);
assert.match(web, /expo export --platform web --dev --clear/);
assert.match(web, /Founder test window/);
assert.match(web, /NO_NORMAL_CHAT_INTEGRATION_AUTHORITY/);
assert.match(simulator, /EXPO_PUBLIC_FOUNDER_COMPANION_HEAD="\$HEAD"/);
assert.doesNotMatch(`${web}\n${simulator}`, /kill\s|pkill|killall|pnpm install|npm install/);

for (const source of [screen, boundary, entry]) {
  assert.doesNotMatch(source, /fetch\s*\(|createClient\s*\(|supabase\.from|AsyncStorage|SecureStore|chat-message|AZURE_OPENAI|raw_prompt|raw_response/i);
}
for (const field of ["normal_chat_route", "runtime_free_text", "account_id", "member_id", "device_id", "thread_id", "raw_prompt", "raw_response", "provider_diagnostics", "birth_data", "persistence", "units"]) {
  assert.ok(control.prohibited.includes(field));
}

console.log("S2-T281 Founder Companion/Chat bridge source contract passed");
