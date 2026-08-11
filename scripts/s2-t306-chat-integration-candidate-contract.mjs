import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const sha256 = (path) => createHash("sha256").update(read(path)).digest("hex");
const control = JSON.parse(read("config/s2-t306-normal-chat-integration-candidate.json"));
const mobile = read("apps/mobile/src/services/normalChatAiCandidate.ts");
const server = read("supabase/functions/_shared/normal-chat-ai-candidate-v1.ts");
const app = read("apps/mobile/App.tsx");
const chat = read("apps/mobile/src/services/chat.ts");

assert.equal(control.schema, "s2_t306_normal_chat_integration_candidate_v1");
assert.equal(control.base_commit, "ad36ddc46f0f46cb473f86aae77b284f73439223");
assert.equal(control.accepted_t240_commit, "beab3bc47d3d32fd0e76673f538f47f368f95347");
assert.equal(control.accepted_t240_schema_sha256, "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07");
assert.equal(control.accepted_dice_evidence_schema, "s2_t296_accepted_dice_v4_technical_evidence_v1");
assert.equal(control.accepted_dice_evidence_sha256, null);
assert.equal(control.accepted_chat_authority_sha256, null);
assert.equal(control.integration_enabled, false);
assert.equal(control.traffic_enabled, false);
assert.equal(control.normal_chat_route_connected, false);
assert.equal(control.provider_client_constructible, false);
assert.equal(control.authority_status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.authority_status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

for (const [path, expected] of Object.entries(control.protected_chat_sources)) {
  assert.equal(sha256(path), expected, `protected Chat source drift: ${path}`);
}

for (const source of [mobile, server]) {
  assert.match(source, /NO_NORMAL_CHAT_INTEGRATION_AUTHORITY/);
  assert.match(source, /NO_AZURE_TRAFFIC_AUTHORITY/);
  assert.match(source, /NORMAL_CHAT_AI_INTEGRATION_ENABLED = false/);
  assert.match(source, /NORMAL_CHAT_AI_TRAFFIC_ENABLED = false/);
  assert.match(source, /Lumis couldn’t complete that reflection just now\. Please try again\./);
  assert.match(source, /Lumis can’t help with that request, but it can offer a safer, general reflection instead\./);
  assert.doesNotMatch(source, /AZURE_OPENAI_API_KEY|Bearer\s+\$|console\.(?:log|error)\s*\(/);
}

assert.match(server, /COMPILED_ACCEPTED_DICE_EVIDENCE_SHA256: string \| null = null/);
assert.match(server, /FINAL_ACCEPTED_DICE_EVIDENCE_SCHEMA = "s2_t296_accepted_dice_v4_technical_evidence_v1"/);
assert.match(server, /resolveAuthenticatedActor/);
assert.match(server, /hasActiveProfile/);
assert.match(server, /commitAtomicSuccess/);
assert.match(server, /providerAttempts: 0 \| 1 \| 2/);
assert.match(server, /startedAt \+ 12_000/);
assert.match(server, /retentionDays: 30/);

assert.doesNotMatch(app, /normalChatAiCandidate|normal-chat-ai-candidate/);
assert.doesNotMatch(chat, /normalChatAiCandidate|normal-chat-ai-candidate|chat-synthetic/);
assert.doesNotMatch(mobile, /chart_context|persona_context|conversation_history|provider_alias|azure_endpoint|api_key/);

console.log("S2_T306_CHAT_INTEGRATION_CANDIDATE_CONTRACT_OK");
