import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = json("config/s2-t276-chat-runtime-review.json");
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(manifest.statuses, ["SOURCE_READY", "LOCAL_DENO_RUNTIME_PROVED", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
for (const [file, digest] of Object.entries(manifest.source_sha256)) assert.equal(sha(read(file)), digest, `drift: ${file}`);

const runtime = json("config/evidence/s2-t276-chat-deno-runtime-proof.json");
assert.deepEqual({ check: runtime.check, serve: runtime.local_serve, probes: runtime.disabled_probe_count, provider: runtime.provider_calls }, { check: "passed", serve: "passed", probes: 4, provider: 0 });
assert.equal(runtime.disabled_code, "CHAT_AI_DISABLED");
assert.equal(runtime.remote_imports, 0);
const deno = json("supabase/functions/chat-synthetic/deno.json");
assert.deepEqual(deno.imports, { "@supabase/supabase-js": "npm:@supabase/supabase-js@2.110.2", "js-tiktoken": "npm:js-tiktoken@1.0.21" });

const index = read("supabase/functions/chat-synthetic/index.ts");
const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
const operator = read("scripts/run-s2-t276-chat-deployment.zsh");
assert.match(index, /async rpc\(name, parameters\)/);
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("request.json()"));
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("const authorityClient = dependencies.createAuthorityClient"));
assert.doesNotMatch(`${index}\n${handler}`, /chat-message|member_id|account_id|console\.(?:log|warn|error)/);
assert.ok(operator.indexOf("--validate-deployment-authorization") < operator.indexOf("LUMIS_CHAT_REMOTE_EXECUTION_APPROVED"));
assert.doesNotMatch(operator, /supabase functions deploy|supabase db push|curl .*https/);

for (const file of [
  "supabase/tests/s2-t276-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t276-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t276-chat-rollback-receipt.schema.json",
  "supabase/tests/s2-t276-founder-chat-fixture-bridge.schema.json"
]) assert.equal(json(file).additionalProperties, false);

const bridge = json("supabase/tests/s2-t276-founder-chat-fixture-bridge.schema.json");
assert.deepEqual(bridge.required, ["schema_version", "fixture_id", "idempotency_key", "run_id"]);
assert.equal(Object.hasOwn(bridge.properties, "message"), false);
assert.equal(Object.hasOwn(bridge.properties, "member_id"), false);

const changed = execFileSync("git", ["diff", "--name-only", manifest.base_commit], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const file of changed) {
  assert.doesNotMatch(file, /^apps\/mobile\//);
  assert.doesNotMatch(file, /^supabase\/functions\/chat-message\//);
  assert.doesNotMatch(file, /^supabase\/migrations\//);
}
console.log(`S2_T276_CHAT_RUNTIME_CONTRACT_OK files=${Object.keys(manifest.source_sha256).length} package=${binding}`);
