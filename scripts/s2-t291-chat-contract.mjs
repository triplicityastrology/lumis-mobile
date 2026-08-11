import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateDeploymentRequest, validateDiceEvidence, validateMigrationRequest, validateTrafficRequest } from "./lib/s2-t291-chat-authority.mjs";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = json("config/s2-t291-chat-v4-final-seal.json");
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(manifest.statuses, ["SOURCE_READY", "LOCAL_DENO_RUNTIME_PROVED", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(manifest.founder_v4_receipt_design_authority.operational_authority, false);
for (const [file, digest] of Object.entries(manifest.source_sha256)) assert.equal(sha(read(file)), digest, `STOP_S2_T291_SOURCE_DRIFT:${file}`);

const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("request.json()"));
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("const authorityClient = dependencies.createAuthorityClient"));
assert.doesNotMatch(handler, /chat-message|member_id|account_id|thread_id|message_id|console\.(?:log|warn|error)/);
const port = read("supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts");
assert.match(port, /lumis_dice_default_off_function_deployment_authorization_v4/);
assert.match(port, /lumis_dice_technical_window_80_accepted_evidence_v4/);
assert.match(port, /be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457/);
assert.doesNotMatch(port, /s2_t282|s2_t284|T254|t254|adbc3b|3ccc/);
const gateway = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
assert.match(gateway, /Lumis couldn’t complete that reflection just now\. Please try again\./);
assert.match(gateway, /Lumis can’t help with that request, but it can offer a safer, general reflection instead\./);
const operator = read("scripts/run-s2-t291-chat-deployment.zsh");
assert.ok(operator.indexOf("--validate-deployment") < operator.indexOf("LUMIS_CHAT_REMOTE_EXECUTION_APPROVED"));
assert.doesNotMatch(operator, /supabase functions deploy|supabase db push|curl .*https|pnpm install|npm install|killall|pkill/);

for (const file of [
  "supabase/tests/s2-t291-dice-v4-technical-evidence.schema.json",
  "supabase/tests/s2-t291-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t291-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t291-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t291-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t291-chat-migration-0040-receipt.schema.json",
  "supabase/tests/s2-t291-chat-post-window-disabled-receipt.schema.json",
  "supabase/tests/s2-t291-founder-chat-verdict.schema.json"
]) assert.equal(json(file).additionalProperties, false, file);

const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const now = Date.parse("2026-08-11T12:00:00.000Z");
const time = { issued_at: "2026-08-11T11:55:00.000Z", valid_until: "2026-08-11T12:05:00.000Z", nonce: "a".repeat(32) };
const dice = {
  schema: "lumis_dice_technical_window_80_accepted_evidence_v4", review_decision: "accepted",
  deployment_receipt: {
    schema: "lumis_dice_default_off_function_deployment_receipt_v4", authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
    source_commit: "b".repeat(40), runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
    disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
    provider_calls: 0, model_invocations: 0, migration_applied: false, post_deploy_disabled: true
  },
  technical_window: {
    schema: "lumis_dice_technical_window_80_evidence_v4", authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY", evidence_package_sha256: "d".repeat(64),
    logical_total: 80, en: 40, zh_hant: 40, attempt_total: 96, max_attempts: 160, input_token_limit: 800, output_token_limit: 300,
    concurrency_limit: 2, shared_deadline_ms: 12000, cost_ceiling_usd: 0.128, provider_disabled_verified: true, finally_disabled: true,
    post_window_disabled_proof_sha256: "f".repeat(64), founder_cases_run: 0, persistence_writes: 0, units_charged: 0
  }, accepted_at: "2026-08-11T10:00:00.000Z"
};
validateDiceEvidence(dice, "e".repeat(64));
for (const hostile of [
  { ...dice, unknown: true },
  { ...dice, deployment_receipt: { ...dice.deployment_receipt, authorization_schema: "v3" } },
  { ...dice, deployment_receipt: { ...dice.deployment_receipt, runtime_package_sha256: "0".repeat(64) } },
  { ...dice, technical_window: { ...dice.technical_window, logical_total: 79 } },
  { ...dice, technical_window: { ...dice.technical_window, finally_disabled: false } }
]) assert.throws(() => validateDiceEvidence(hostile, "e".repeat(64)));

const deployment = { schema: "s2_t291_chat_default_off_deployment_request_v1", authority: "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY", project_ref: manifest.project_ref, function_name: manifest.function_name, review_package_sha256: binding, source_commit: head, provider_enabled: false, provider_calls_allowed: 0, disabled_probe_count: 4, migration_0040_authorized: false, traffic_authorized: false, normal_chat_connected: false, rollback_revision_sha256: "f".repeat(64), ...time };
validateDeploymentRequest(deployment, manifest, head, now);
assert.throws(() => validateDeploymentRequest({ ...deployment, traffic_authorized: true }, manifest, head, now));
assert.throws(() => validateDeploymentRequest({ ...deployment, valid_until: "2026-08-11T12:20:00.000Z" }, manifest, head, now));
const migration = { schema: "s2_t291_chat_migration_0040_request_v1", authority: "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY", project_ref: manifest.project_ref, migration_version: "0040", migration_sha256: manifest.migration_0040_sha256, review_package_sha256: binding, source_commit: head, function_deployment_authorized: false, traffic_authorized: false, provider_calls_allowed: 0, ...time };
validateMigrationRequest(migration, manifest, head, now);
assert.throws(() => validateMigrationRequest({ ...migration, function_deployment_authorized: true }, manifest, head, now));
const acceptedManifest = { ...manifest, accepted_dice_evidence_sha256: "e".repeat(64) };
const traffic = { schema: "s2_t291_chat_synthetic_traffic_request_v1", authority: "CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY", project_ref: manifest.project_ref, function_name: manifest.function_name, review_package_sha256: binding, source_commit: head, accepted_dice_evidence_sha256: "e".repeat(64), deployment_receipt_sha256: "1".repeat(64), migration_0040_receipt_sha256: "2".repeat(64), fixture_count: 60, language_counts: { en: 30, zh_hant: 30 }, runtime_request_fields: ["fixture_id"], normal_chat_connected: false, member_context: false, threads: false, messages: false, persistence_writes: 0, units_charged: 0, ...time };
validateTrafficRequest(traffic, acceptedManifest, head, now);
assert.throws(() => validateTrafficRequest(traffic, manifest, head, now));
assert.throws(() => validateTrafficRequest({ ...traffic, messages: true }, acceptedManifest, head, now));

const changed = execFileSync("git", ["diff", "--name-only", manifest.base_commit], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const file of changed) assert.doesNotMatch(file, /^supabase\/functions\/chat-message\/|^apps\/mobile\/src\/(?:features\/chat|services\/chat\.ts)/);
console.log(`S2_T291_CHAT_CONTRACT_OK package=${binding} dice=${dice.schema} files=${Object.keys(manifest.source_sha256).length}`);
