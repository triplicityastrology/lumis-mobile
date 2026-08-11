import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => readFileSync(file, "utf8");
const release = JSON.parse(read("config/s2-t267-dice-edge-release.json"));
const control = JSON.parse(read("config/s2-t259-dice-authorization-control.json"));
const canonical = JSON.parse(read("config/s2-t257-canonical-dice-gateway-manifest.json"));
const authority = JSON.parse(read("config/s2-t263-dice-edge-authority.json"));

assert.equal(release.schema, "s2_t267_dice_edge_release_v1");
assert.deepEqual(release.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.match(release.package_sha256, /^[a-f0-9]{64}$/);
assert.equal(release.package_sha256, control.source_seal.package_sha256);
assert.equal(release.package_sha256, canonical.package_sha256);
assert.equal(release.package_sha256, authority.canonical_package_sha256);
assert.equal(release.registry_sha256, control.canonical_sha256.registry);
for (const [file, expected] of Object.entries(release.files)) {
  assert.equal(digest(readFileSync(file)), expected, `sealed file drift: ${file}`);
  assert.notEqual(digest(Buffer.concat([readFileSync(file), Buffer.from("hostile-drift")])), expected, `hostile drift accepted: ${file}`);
}
const calculatedPackage = digest(Object.entries(control.source_seal.files).sort(([left], [right]) => left.localeCompare(right))
  .map(([file, hash]) => `${file}\0${hash}`).join("\n"));
assert.equal(calculatedPackage, release.package_sha256);

const entry = read("supabase/functions/dice-synthetic/index.ts");
const handler = read("supabase/functions/dice-synthetic/edge-handler-v1.ts");
const adapter = read("supabase/functions/_shared/azure-dice-adapter-v1.ts");
const tokenizer = read("supabase/functions/_shared/dice-tokenizer-v1.ts");
const denoConfig = JSON.parse(read("supabase/functions/dice-synthetic/deno.json"));
const migration = read("supabase/migrations/0039_dice_synthetic_authority_ledger.sql");
assert.match(handler, new RegExp(`DICE_EDGE_PACKAGE_SHA256 = "${release.package_sha256}"`));
assert.match(handler, new RegExp(`DICE_EDGE_REGISTRY_SHA256 = "${release.registry_sha256}"`));
assert.equal(denoConfig.imports["js-tiktoken"], "npm:js-tiktoken@1.0.21");
assert.match(tokenizer, /from "js-tiktoken"/);
assert.match(tokenizer, /DICE_TOKENIZER_PACKAGE = "npm:js-tiktoken@1\.0\.21"/);
assert.equal(readFileSync("package.json", "utf8").includes('"js-tiktoken": "1.0.21"'), true);
assert.equal(release.files["scripts/fixtures/js-tiktoken/index.js"], undefined);
assert.doesNotMatch(entry, /LUMIS_AI_ENABLED|AZURE_OPENAI_|LUMIS_AI_PROVIDER/);
for (const name of control.configuration_names.filter((name) => name.startsWith("LUMIS_DICE_"))) assert.match(`${entry}\n${adapter}`, new RegExp(name));
assert.match(adapter, /\/openai\/\$\{config\.routeFamily\}\/responses/);
assert.doesNotMatch(adapter, /preview|api-version=|chat\/completions/);
assert.match(migration, /on conflict \(run_id\) do nothing/i);
assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/i);
assert.match(migration, /force row level security/i);
assert.equal(release.files["config/evidence/s2-t262-azure-foundry-deployment-readonly-v1.json"], "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f");
assert.equal(release.files["config/evidence/s2-t262-azure-foundry-sanitized-price-v1.json"], "2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772");
assert.equal(release.files["config/evidence/s2-t262-azure-foundry-api-route-family-v1.json"], "2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e");
console.log(`S2_T267_DICE_EDGE_RELEASE_CONTRACT_OK files=${Object.keys(release.files).length} package=${release.package_sha256}`);
