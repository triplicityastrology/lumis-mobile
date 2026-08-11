import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DICE_ACCEPTED_ENVELOPE_SCHEMA,
  DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA,
  DICE_DEPLOYMENT_COMMIT,
  DICE_DEPLOYMENT_RECEIPT_SCHEMA,
  DICE_RUNTIME_PACKAGE,
  DICE_TECHNICAL_SCHEMA,
  canonicalJson,
  repositoryIdentity,
  validateDeploymentAuthorization,
  validateDiceAcceptedEvidence,
  validateMigrationAuthorization,
  validateTrafficAuthorization
} from "./lib/s2-t296-chat-operational.mjs";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const control = json("config/s2-t296-chat-operational-control.json");
const seal = json("config/s2-t296-chat-operational-seal.json");
const runtimeProof = json("config/evidence/s2-t296-chat-deno-runtime-proof.json");
const { package_binding_sha256: binding, ...bound } = seal;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(control.authority_status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.deepEqual(control.dice_prerequisite, {
  deployment_commit: DICE_DEPLOYMENT_COMMIT,
  authorization_schema: DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA,
  runtime_package_sha256: DICE_RUNTIME_PACKAGE,
  post_deploy_receipt_schema: DICE_DEPLOYMENT_RECEIPT_SCHEMA,
  technical_commit: "4b2c8c7578773b59b04d4e44ef4ca2dc57b7555f",
  technical_evidence_schema: DICE_TECHNICAL_SCHEMA,
  technical_authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  accepted_evidence_sha256: null
});
assert.deepEqual(control.compiled_authorities, { dice_technical_evidence_sha256: null, deployment_authorization_sha256: null, migration_0040_authorization_sha256: null, traffic_authorization_sha256: null });
assert.deepEqual([runtimeProof.schema, runtimeProof.runtime.deno, runtimeProof.check, runtimeProof.local_serve, runtimeProof.disabled_probe_count, runtimeProof.disabled_code, runtimeProof.provider_calls, runtimeProof.remote_imports, runtimeProof.network_scope], ["s2_t296_chat_deno_runtime_proof_v1", "2.2.12", "passed", "passed", 4, "CHAT_AI_DISABLED", 0, 0, "loopback_only"]);
assert.equal(control.approved_copy.fixed_fallback, "Lumis couldn’t complete that reflection just now. Please try again.");
assert.equal(control.approved_copy.safety_redirect, "Lumis can’t help with that request, but it can offer a safer, general reflection instead.");
for (const [file, digest] of Object.entries(seal.source_sha256)) assert.equal(sha(read(file)), digest, `STOP_S2_T296_SOURCE_DRIFT:${file}`);

const identity = repositoryIdentity(root);
const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("request.json()"));
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("dependencies.createAuthorityClient"));
assert.doesNotMatch(handler, /chat-message|member_id|account_id|thread_id|message_id|console\.(?:log|warn|error)/);
const gateway = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
assert.match(gateway, /Lumis couldn’t complete that reflection just now\. Please try again\./);
assert.match(gateway, /Lumis can’t help with that request, but it can offer a safer, general reflection instead\./);
const registry = read("supabase/functions/_shared/chat-synthetic-registry-v1.ts");
assert.doesNotMatch(registry, /dice_(?:en|zh)|DICE_FOUNDER|natal|birth chart/iu);
const mobile = read("apps/mobile/src/dev/FounderCompanionChatJourney.tsx");
assert.match(mobile, /S2-T296 · CHAT OPERATIONAL REVIEW/);
assert.match(mobile, /30 EN \/ 30/);
assert.match(mobile, /Runtime accepts only fixture_id/);

for (const file of [
  "supabase/tests/s2-t296-accepted-dice-v4-evidence.schema.json",
  "supabase/tests/s2-t296-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t296-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t296-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t296-chat-migration-0040-authorization.schema.json",
  "supabase/tests/s2-t296-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t296-chat-synthetic-traffic-authorization.schema.json"
]) assert.equal(json(file).additionalProperties, false, file);

const records = Array.from({ length: 80 }, (_, index) => ({ fixture_id: `technical-${index + 1}` }));
const dice = {
  schema: DICE_ACCEPTED_ENVELOPE_SCHEMA,
  review_decision: "accepted",
  deployment_receipt: {
    schema: DICE_DEPLOYMENT_RECEIPT_SCHEMA, authorization_schema: DICE_DEPLOYMENT_AUTHORIZATION_SCHEMA, project_ref: control.project_ref,
    function_name: "dice-synthetic", deployment_id: "dice-deploy-example00000001", source_commit: DICE_DEPLOYMENT_COMMIT,
    runtime_package_sha256: DICE_RUNTIME_PACKAGE, disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
    provider_calls: 0, model_invocations: 0, kill_switch_disabled: true, traffic_switch_disabled: true, migration_applied: false,
    deployed_at: "2026-08-11T09:00:00.000Z", valid_until: "2026-08-11T14:00:00.000Z"
  },
  technical_evidence: {
    schema: DICE_TECHNICAL_SCHEMA, run_id: "dice-tech80-example000001", deployment_id: "dice-deploy-example00000001", runtime_package_sha256: DICE_RUNTIME_PACKAGE,
    migration_proof_receipt_sha256: "a".repeat(64), registry_sha256: "b".repeat(64), technical_case_count: 80, founder_case_count: 0,
    language: { en: 40, "zh-Hant": 40 }, attempt_total: 96, concurrency_peak: 2, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128,
    provider_disabled_verified: true, effects: { provider_calls: 96, model_invocations: 96, persistence_writes: 0, units_charged: 0, finally_disabled: true, post_window_disabled_proof_sha256: "c".repeat(64) }, records
  },
  accepted_at: "2026-08-11T14:01:00.000Z"
};
validateDiceAcceptedEvidence(dice, "d".repeat(64));
for (const hostile of [
  { ...dice, unknown: true },
  { ...dice, deployment_receipt: { ...dice.deployment_receipt, source_commit: "0".repeat(40) } },
  { ...dice, technical_evidence: { ...dice.technical_evidence, technical_case_count: 79 } },
  { ...dice, technical_evidence: { ...dice.technical_evidence, records: records.slice(1) } },
  { ...dice, technical_evidence: { ...dice.technical_evidence, effects: { ...dice.technical_evidence.effects, units_charged: 1 } } }
]) assert.throws(() => validateDiceAcceptedEvidence(hostile, "d".repeat(64)));

const now = Date.parse("2026-08-11T12:00:00.000Z");
const time = { issued_at: "2026-08-11T11:55:00.000Z", valid_until: "2026-08-11T12:05:00.000Z", nonce: "a".repeat(32), signature_algorithm: "Ed25519", microsoft_signature_base64: `${"A".repeat(86)}==` };
const common = { decision: "AUTHORIZED", project_ref: control.project_ref, review_package_sha256: binding, source_commit: identity.head, source_tree: identity.tree, request_sha256: "b".repeat(64), ...time };
const deployment = { schema: "s2_t296_chat_default_off_deployment_authorization_v1", authority_scope: control.scopes.deployment, function_name: control.function_name, provider_enabled: false, provider_calls_allowed: 0, disabled_probe_count: 4, migration_0040_authorized: false, traffic_authorized: false, normal_chat_connected: false, rollback_revision_sha256: "c".repeat(64), ...common };
assert.throws(() => validateDeploymentAuthorization(deployment, seal, identity, now));
const deploymentSeal = { ...seal, compiled_authorities: { ...seal.compiled_authorities, deployment_authorization_sha256: sha(canonicalJson(deployment)) } };
validateDeploymentAuthorization(deployment, deploymentSeal, identity, now);
assert.throws(() => validateDeploymentAuthorization({ ...deployment, traffic_authorized: true }, deploymentSeal, identity, now));
assert.throws(() => validateDeploymentAuthorization({ ...deployment, valid_until: "2026-08-11T12:20:00.000Z" }, deploymentSeal, identity, now));
assert.throws(() => validateDeploymentAuthorization({ ...deployment, nonce: "0".repeat(31) }, deploymentSeal, identity, now));
const migration = { schema: "s2_t296_chat_migration_0040_authorization_v1", authority_scope: control.scopes.migration, migration_version: "0040", migration_sha256: control.migration_0040_sha256, function_deployment_authorized: false, traffic_authorized: false, provider_calls_allowed: 0, ...common };
assert.throws(() => validateMigrationAuthorization(migration, seal, identity, now));
const migrationSeal = { ...seal, compiled_authorities: { ...seal.compiled_authorities, migration_0040_authorization_sha256: sha(canonicalJson(migration)) } };
validateMigrationAuthorization(migration, migrationSeal, identity, now);
assert.throws(() => validateMigrationAuthorization({ ...migration, function_deployment_authorized: true }, migrationSeal, identity, now));
const traffic = { schema: "s2_t296_chat_synthetic_traffic_authorization_v1", authority_scope: control.scopes.traffic, function_name: control.function_name, accepted_dice_evidence_sha256: "d".repeat(64), deployment_receipt_sha256: "e".repeat(64), migration_0040_receipt_sha256: "f".repeat(64), fixture_registry_sha256: "1".repeat(64), fixture_count: 60, language_counts: { en: 30, zh_hant: 30 }, attempt_cap: 120, input_token_cap: 1200, output_token_cap: 300, concurrency: 1, eligible_retries: 1, shared_deadline_ms: 12000, runtime_request_fields: ["fixture_id"], normal_chat_connected: false, member_context: false, threads: false, messages: false, persistence_writes: 0, units_charged: 0, ...common };
assert.throws(() => validateTrafficAuthorization(traffic, seal, identity, now));
const trafficSeal = { ...seal, accepted_dice_evidence_sha256: "d".repeat(64), compiled_authorities: { ...seal.compiled_authorities, traffic_authorization_sha256: sha(canonicalJson(traffic)) } };
validateTrafficAuthorization(traffic, trafficSeal, identity, now);
assert.throws(() => validateTrafficAuthorization({ ...traffic, messages: true }, trafficSeal, identity, now));

const changed = execFileSync("git", ["diff", "--name-only", control.base_commit], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const file of changed) assert.doesNotMatch(file, /^supabase\/functions\/chat-message\/|^apps\/mobile\/src\/(?:features\/chat|services\/chat\.ts)/);
for (const script of ["scripts/start-s2-t296-founder-chat-web.sh", "scripts/start-s2-t296-founder-chat-simulator.sh", "scripts/start-s2-t296-founder-chat-expo.sh"]) {
  const source = read(script);
  assert.match(source, /PORT >= 8160/);
  assert.doesNotMatch(source, /killall|pkill|kill -9|pnpm install|npm install/);
}
const operator = read("scripts/s2-t296-chat-operator.mjs");
assert.doesNotMatch(operator, /fetch\(|curl|supabase functions deploy|supabase db push/);
console.log(`S2_T296_CHAT_OPERATIONAL_CONTRACT_OK package=${binding} changed=${changed.length}`);
