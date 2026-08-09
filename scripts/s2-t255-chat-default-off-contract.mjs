import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const control = JSON.parse(read("supabase/tests/s2-t255-chat-default-off-control.json"));
const registry = read("supabase/functions/_shared/chat-synthetic-registry-v1.ts");
const prompt = read("supabase/functions/_shared/companion-synthetic-prompt-v1.ts");
const gateway = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
const route = read("supabase/functions/chat-synthetic/index.ts");
const normalChat = read("supabase/functions/chat-message/index.ts");

assert.deepEqual(control.statuses, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(control.route, "chat-synthetic");
assert.equal(control.normal_chat_connected, false);
assert.equal(control.default_enabled, false);
assert.deepEqual(control.fixture_registry, {
  version: "chat_synthetic_registry_v1",
  total: 60,
  en: 30,
  zh_hant: 30,
  request_fields: ["fixture_id", "idempotency_key", "run_id"]
});
assert.equal(control.prompt.version, "companion_synthetic_prompt_v1");
assert.equal(control.prompt.server_only, true);
assert.equal(control.prompt.customer_context, "none");
assert.equal(control.prompt.persona_or_provenance, "prohibited");
assert.equal(control.deployment.executed, false);
assert.equal(control.deployment.provider_calls, 0);

for (const [path, expected] of Object.entries(control.source_sha256)) {
  const actual = createHash("sha256").update(read(path)).digest("hex");
  assert.equal(actual, expected, `source checksum drift: ${path}`);
}

assert.match(registry, /pairedFixtures/);
assert.match(prompt, /do not infer identity, biography, astrology, Persona, chart data, provenance, or conversation history/);
assert.match(prompt, /CHAT_SYNTHETIC_SAFETY_BEFORE_PROMPT/);
assert.match(gateway, /COMPANION_SYNTHETIC_PROMPT_VERSION/);
assert.match(gateway, /assembleCompanionSyntheticPrompt/);
assert.match(route, /if \(!enabled\).*CHAT_SYNTHETIC_PROVIDER_DISABLED/s);
assert.match(route, /if \(!endpoint \|\| !apiKey\).*CHAT_SYNTHETIC_CONFIGURATION_UNAVAILABLE/s);
assert.ok(route.indexOf("if (!enabled)") < route.indexOf("getEnabledGateway().handle"));
assert.doesNotMatch(route, /chat-message|createClient|persist|unit_ledger|account_id|device_id/);
assert.doesNotMatch(normalChat, /chat-synthetic|azure-chat-synthetic|AZURE_FOUNDRY_CHAT/);

for (const source of [registry, prompt, gateway, route]) {
  assert.doesNotMatch(source, /EXPO_PUBLIC_|AsyncStorage|profile_id|birth_data|device_id/);
}

console.log("S2-T255 Chat default-off candidate contract passed");
