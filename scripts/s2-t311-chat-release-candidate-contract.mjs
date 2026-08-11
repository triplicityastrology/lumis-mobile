import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const control = JSON.parse(read("config/s2-t311-chat-release-candidate.json"));
const seal = JSON.parse(read("config/s2-t311-chat-release-candidate-seal.json"));
const mobile = read("apps/mobile/src/services/chatReleaseCandidate.ts");
const server = read("supabase/functions/_shared/normal-chat-release-candidate-v1.ts");
const index = read("apps/mobile/index.ts");
const founderProduct = read("apps/mobile/src/dev/FounderPolishedChatExperience.tsx");
const founderContract = read("apps/mobile/src/dev/founderPolishedChatContract.ts");
const t306Mobile = read("apps/mobile/src/services/normalChatAiCandidate.ts");
const t306Server = read("supabase/functions/_shared/normal-chat-ai-candidate-v1.ts");

assert.deepEqual(
  [control.integration_enabled, control.traffic_enabled, control.normal_chat_route_connected, control.provider_constructible],
  [false, false, false, false],
);
assert.equal(control.authority_status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.authority_status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.deepEqual(control.runtime_request_fields, ["schema_version", "fixture_id"]);
assert.deepEqual(control.fixture_ids, ["chat-en-reflection-01", "chat-zh-hant-reflection-01"]);
assert.match(seal.package_sha256, /^[a-f0-9]{64}$/);
assert.deepEqual(seal.authorities, {
  t240: "beab3bc47d3d32fd0e76673f538f47f368f95347",
  t299: "5797ddeee0402c88f39fecfa45d060ea7991061a",
  t306: "78c0ce93f211c9ded4d2e65cb789b5dfbfeb9df3",
});
assert.match(mobile, /CHAT_RELEASE_CANDIDATE_ENABLED = false/);
assert.match(mobile, /CHAT_RELEASE_TRAFFIC_ENABLED = false/);
assert.match(server, /CHAT_RELEASE_SERVER_ENABLED = false/);
assert.match(server, /CHAT_RELEASE_SERVER_TRAFFIC_ENABLED = false/);
assert.ok(server.indexOf("!CHAT_RELEASE_SERVER_ENABLED") < server.indexOf("parseRequest(rawRequest)"));
assert.match(server, /s2_t296_accepted_dice_v4_technical_evidence_v1/);
assert.match(server, /s2_t311_chat_default_off_deployment_receipt_v1/);
assert.match(server, /s2_t311_chat_synthetic_traffic_authorization_v1/);
assert.doesNotMatch(mobile, /endpoint|api[_-]?key|bearer|birth|account_id|member_id/i);
assert.doesNotMatch(server, /console\.|Deno\.env|getSupabaseClient|chat-message/);
assert.doesNotMatch(index, /chatReleaseCandidate|normalChatAiCandidate/);
assert.match(index, /__DEV__ && process\.env\.EXPO_PUBLIC_FOUNDER_POLISHED_CHAT === "1"/);
assert.match(founderProduct, /Founder evidence controls outside product pixels/);
assert.match(founderProduct, /Founder Talk preview · offline fixture/);
assert.match(founderProduct, /KeyboardAvoidingView/);
assert.match(founderProduct, /ChatFailedReply/);
assert.match(founderContract, /provider_calls: 0/);
assert.match(founderContract, /persistence_writes: 0/);
assert.match(founderContract, /T240_FIXED_FALLBACK/);
assert.match(founderContract, /T240_SAFETY_REDIRECT/);
assert.match(t306Mobile, /NORMAL_CHAT_AI_INTEGRATION_ENABLED = false/);
assert.match(t306Mobile, /NORMAL_CHAT_AI_TRAFFIC_ENABLED = false/);
assert.match(t306Server, /COMPILED_ACCEPTED_DICE_EVIDENCE_SHA256: string \| null = null/);
assert.ok(t306Server.indexOf("!NORMAL_CHAT_AI_INTEGRATION_ENABLED") < t306Server.indexOf("parseMobileRequest(rawRequest)"));

const protectedSources = {
  "apps/mobile/App.tsx": "8af09a8ec4a1d5dc71670790a0f97dd993fe3fee55cc94614b9b73b8439bed63",
  "apps/mobile/src/services/chat.ts": "4a0b70e514c160dc55541e2909d45748347a76fe0561fb72de6a3d371a242392",
  "apps/mobile/src/components/ChatThinkingIndicator.tsx": "f5eaf0febeb1317f5df3a5c5658a1880c1bd0d2b5da2457edd4694a4514eadaa",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx": "669cf97c450d02662d572b92686d70af1f8c00810ac440f42221f982e3fdef70",
};
for (const [path, expected] of Object.entries(protectedSources)) assert.equal(sha256(read(path)), expected, `${path} drift`);

for (const schemaPath of [
  "supabase/tests/s2-t311-chat-deployment-receipt.schema.json",
  "supabase/tests/s2-t311-chat-traffic-authorization.schema.json",
]) {
  const schema = JSON.parse(read(schemaPath));
  assert.equal(schema.additionalProperties, false);
}

for (const launcher of [
  "scripts/start-s2-t311-founder-chat-web.sh",
  "scripts/start-s2-t311-founder-chat-simulator.sh",
  "scripts/start-s2-t311-founder-chat-expo.sh",
]) {
  const source = read(launcher);
  assert.match(source, /codex\/s2-t311-chat-release-candidate/);
  assert.match(source, /EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1/);
  assert.doesNotMatch(source, /killall|pkill|kill -9|pnpm install|npm install/);
}

const changed = execFileSync("git", ["diff", "--name-only", "78c0ce93f211c9ded4d2e65cb789b5dfbfeb9df3"], { encoding: "utf8" });
for (const protectedPath of Object.keys(protectedSources)) assert.ok(!changed.split("\n").includes(protectedPath));

console.log("S2_T311_CHAT_RELEASE_CANDIDATE_CONTRACT_OK");
