import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const review = JSON.parse(read("config/s2-t260-chat-canonical-port-review.json"));
const { package_binding_sha256: packageBinding, ...boundReview } = review;
assert.equal(sha256(JSON.stringify(boundReview)), packageBinding, "review package binding drift");

assert.deepEqual(review.statuses, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(review.gateway_interface, "chat_synthetic_gateway_port_v1");
assert.equal(review.authority_store, "chat_synthetic_postgres_authority_store_v1");
assert.equal(review.tokenizer, "o200k_base");
assert.equal(review.accepted_dice_evidence_sha256, null);
assert.equal(review.execution_authority, false);
assert.equal(review.migration_deployed, false);
assert.equal(review.deployment_authorization_issued, false);
assert.equal(review.deployment_executed, false);
assert.equal(review.chat_traffic, 0);
assert.equal(review.normal_chat_connected, false);

for (const [path, expected] of Object.entries(review.source_sha256)) {
  assert.equal(sha256(read(path)), expected, `review checksum drift: ${path}`);
}
assert.equal(sha256(read("supabase/tests/s2-t193-normal-chat-contract-v1.schema.json")), review.canonical_t240_schema_sha256);

const gateway = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
const port = read("supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts");
const adapter = read("supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts");
const prompt = read("supabase/functions/_shared/companion-synthetic-prompt-v1.ts");
const index = read("supabase/functions/chat-synthetic/index.ts");
const authorityStore = read("supabase/functions/_shared/chat-synthetic-postgres-authority-store-v1.ts");
assert.doesNotMatch(gateway, /estimateTokens|outputTokens:\s*number|providerResult\.outputTokens/);
assert.match(gateway, /this\.#tokenizer\.count\(promptInput\)/);
assert.match(gateway, /this\.#tokenizer\.count\(message\)/);
assert.match(port, /validateAcceptedDiceEvidence[\s\S]+validateChatAuthority/);
assert.match(port, /CHAT_SYNTHETIC_FIXTURE_ALREADY_USED/);
assert.match(port, /CHAT_SYNTHETIC_AUTHORITY_REPLAYED/);
assert.match(port, /consumeAuthority/);
assert.match(port, /consumeFixture/);
assert.match(port, /CHAT_SYNTHETIC_AUTHORITY_STORE_UNAVAILABLE/);
assert.doesNotMatch(port, /new Set|consumedAuthorityHashes|consumedRunIds/);
assert.match(authorityStore, /consume_chat_synthetic_authority_v1/);
assert.match(authorityStore, /consume_chat_synthetic_fixture_v1/);
assert.match(authorityStore, /crypto\.subtle\.digest\("SHA-256"/);
assert.match(adapter, /lumis-ai-chat-stg\.openai\.azure\.com/);
assert.match(adapter, /2024-10-21/);
assert.match(adapter, /DefaultV2/);
assert.doesNotMatch(index, /console\.(?:log|info|warn|error)|chat-message|member/);
assert.doesNotMatch(prompt, /Persona|provenance/);

for (const schemaPath of [
  "supabase/tests/s2-t260-accepted-dice-technical-evidence.schema.json",
  "supabase/tests/s2-t260-chat-single-use-authority.schema.json",
  "supabase/tests/s2-t260-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t260-chat-review-package.schema.json"
]) JSON.parse(read(schemaPath));

const changed = execFileSync("git", ["diff", "--name-only", review.base_commit], { cwd: new URL(".", root), encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const path of changed) {
  assert.doesNotMatch(path, /^apps\/mobile\//, `mobile integration prohibited: ${path}`);
  assert.doesNotMatch(path, /^supabase\/functions\/chat-message\//, `normal chat integration prohibited: ${path}`);
  if (path.startsWith("supabase/migrations/")) {
    assert.equal(path, "supabase/migrations/0040_chat_synthetic_authority_ledger.sql", `unapproved persistence change: ${path}`);
  }
}

console.log(`S2-T260 checksum, authority, safety, and isolated-diff contract passed (${changed.length} files)`);
