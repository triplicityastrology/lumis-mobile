import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = json("config/s2-t270-chat-edge-final.json");
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(manifest.statuses, ["SOURCE_COMPLETE", "LOCAL_EMULATOR_ONLY", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(manifest.execution.provider_calls, 0);
assert.equal(manifest.execution.deployment, false);
assert.equal(manifest.execution.normal_chat_connected, false);
for (const [file, digest] of Object.entries(manifest.source_sha256)) assert.equal(sha(read(file)), digest, `drift: ${file}`);

const edge = read("supabase/functions/chat-synthetic/index.ts");
const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
const adapter = read("supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts");
const port = read("supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts");
const migration = read("supabase/migrations/0040_chat_synthetic_authority_ledger.sql");
const deno = json("supabase/functions/chat-synthetic/deno.json");
const bundle = read(".tmp/chat-synthetic-edge-v1-bundle/chat-synthetic.bundle.js");
const packageJson = json("node_modules/js-tiktoken/package.json");

assert.match(edge, /Deno\.serve\(handler\)/);
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("const authorityClient = dependencies.createAuthorityClient"));
assert.match(handler, /CHAT_AI_DISABLED/);
assert.doesNotMatch(`${edge}\n${handler}`, /chat-message|member_id|user_id|birth|console\.(?:log|warn|error)/);
assert.match(adapter, /lumis-foundry-stg-sea-20260731\.services\.ai\.azure\.com/);
assert.match(adapter, /\/openai\/\$\{config\.routeFamily\}\/responses/);
assert.doesNotMatch(adapter, /chat\/completions|api-version=|2024-\d{2}-\d{2}|openai\.azure\.com/);
assert.equal(deno.imports["js-tiktoken"], "npm:js-tiktoken@1.0.21");
assert.equal(packageJson.version, "1.0.21");
assert.ok(bundle.length > 45_000);
for (const marker of ["Deno.serve", "createChatSyntheticEdgeHandler", "o200k_base", "CHAT_AI_DISABLED", "consume_chat_synthetic_authority_v1", "lumis-foundry-stg-sea-20260731.services.ai.azure.com"]) {
  assert.ok(bundle.includes(marker), `bundle missing ${marker}`);
}
assert.match(port, /adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71/);
assert.match(migration, /interval '30 days'/);
assert.match(migration, /auth\.role\(\) <> 'service_role'/);
assert.doesNotMatch(migration, /prompt_text|response_text|member_id|units_charged/);
assert.equal(sha(read("supabase/tests/s2-t193-normal-chat-contract-v1.schema.json")), manifest.accepted_t240_schema_sha256);
assert.doesNotMatch(JSON.stringify(manifest), /api.?key.*value|credential|bearer|member_id|endpoint_url/iu);
console.log(`S2_T270_CHAT_EDGE_FINAL_OK files=${Object.keys(manifest.source_sha256).length} package=${binding}`);
