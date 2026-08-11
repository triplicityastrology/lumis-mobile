import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateDeploymentRequest, validateDiceEvidence, validateMigrationRequest, validateTrafficRequest } from "./lib/s2-t286-chat-authority.mjs";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const manifest = json("config/s2-t286-chat-deploy-test-final-seal.json");
const { package_binding_sha256: binding, ...bound } = manifest;
assert.equal(sha(JSON.stringify(bound)), binding);
assert.deepEqual(manifest.statuses, ["SOURCE_READY", "LOCAL_DENO_RUNTIME_PROVED", "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
for (const [file, digest] of Object.entries(manifest.source_sha256)) assert.equal(sha(read(file)), digest, `STOP_S2_T286_SOURCE_DRIFT:${file}`);

const runtime = json("config/evidence/s2-t276-chat-deno-runtime-proof.json");
assert.deepEqual([runtime.check, runtime.local_serve, runtime.disabled_probe_count, runtime.disabled_code, runtime.provider_calls], ["passed", "passed", 4, "CHAT_AI_DISABLED", 0]);
const handler = read("supabase/functions/chat-synthetic/edge-handler-v1.ts");
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("request.json()"));
assert.ok(handler.indexOf('LUMIS_CHAT_AI_ENABLED !== "true"') < handler.indexOf("const authorityClient = dependencies.createAuthorityClient"));
assert.doesNotMatch(handler, /chat-message|member_id|account_id|thread_id|message_id|console\.(?:log|warn|error)/);
const port = read("supabase/functions/_shared/chat-synthetic-gateway-port-v1.ts");
assert.match(port, /s2_t284_dice_technical_evidence_acceptance_v1/);
assert.match(port, /s2_t282_dice_default_off_deployment_receipt_v1/);
assert.doesNotMatch(port, /T254|t254|adbc3b/);
const gateway = read("supabase/functions/_shared/chat-synthetic-gateway-v1.ts");
assert.match(gateway, /Lumis couldn’t complete that reflection just now\. Please try again\./);
assert.match(gateway, /Lumis can’t help with that request, but it can offer a safer, general reflection instead\./);
const operator = read("scripts/run-s2-t286-chat-deployment.zsh");
assert.ok(operator.indexOf("--validate-deployment") < operator.indexOf("LUMIS_CHAT_REMOTE_EXECUTION_APPROVED"));
assert.doesNotMatch(operator, /supabase functions deploy|supabase db push|curl .*https|pnpm install|npm install|killall|pkill/);

for (const file of [
  "supabase/tests/s2-t286-dice-technical-evidence-acceptance.schema.json",
  "supabase/tests/s2-t286-chat-default-off-deployment-request.schema.json",
  "supabase/tests/s2-t286-chat-default-off-deployment-receipt.schema.json",
  "supabase/tests/s2-t286-chat-synthetic-traffic-request.schema.json",
  "supabase/tests/s2-t286-chat-migration-0040-request.schema.json",
  "supabase/tests/s2-t286-chat-post-window-disabled-receipt.schema.json"
  ,"supabase/tests/s2-t286-founder-chat-verdict.schema.json"
]) assert.equal(json(file).additionalProperties, false, file);

const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const now = Date.parse("2026-08-11T12:00:00.000Z");
const time = { issued_at: "2026-08-11T11:00:00.000Z", valid_until: "2026-08-11T13:00:00.000Z", nonce: "a".repeat(32) };
const dice = {
  schema: "s2_t284_dice_technical_evidence_acceptance_v1", review_decision: "accepted",
  deployment_receipt: { schema: "s2_t282_dice_default_off_deployment_receipt_v1", source_commit: "b".repeat(40), runtime_package_sha256: "c".repeat(64), disabled_probes: Array(4).fill("DICE_AI_DISABLED"), provider_calls: 0, model_invocations: 0, migration_applied: false },
  technical_window: { authority: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY", evidence_package_sha256: "d".repeat(64), logical_total: 80, en: 40, zh_hant: 40, attempt_total: 96, max_attempts: 160, provider_disabled_verified: true, founder_cases_run: 0, persistence_writes: 0, units_charged: 0 },
  accepted_at: "2026-08-11T10:00:00.000Z"
};
validateDiceEvidence(dice, "e".repeat(64));
for (const hostile of [
  { ...dice, unknown: true },
  { ...dice, deployment_receipt: { ...dice.deployment_receipt, provider_calls: 1 } },
  { ...dice, technical_window: { ...dice.technical_window, logical_total: 79 } },
  { ...dice, technical_window: { ...dice.technical_window, attempt_total: 161 } }
]) assert.throws(() => validateDiceEvidence(hostile, "e".repeat(64)));

const deployment = { schema: "s2_t286_chat_default_off_deployment_request_v1", authority: "CHAT_SYNTHETIC_DEFAULT_OFF_DEPLOYMENT_ONLY", project_ref: manifest.project_ref, function_name: manifest.function_name, review_package_sha256: binding, source_commit: head, provider_enabled: false, provider_calls_allowed: 0, disabled_probe_count: 4, migration_0040_authorized: false, traffic_authorized: false, normal_chat_connected: false, rollback_revision_sha256: "f".repeat(64), ...time };
validateDeploymentRequest(deployment, manifest, head, now);
assert.throws(() => validateDeploymentRequest({ ...deployment, migration_0040_authorized: true }, manifest, head, now));
assert.throws(() => validateDeploymentRequest({ ...deployment, valid_until: "2026-08-11T11:30:00.000Z" }, manifest, head, now));
const migration = { schema: "s2_t286_chat_migration_0040_request_v1", authority: "CHAT_SYNTHETIC_AUTHORITY_LEDGER_0040_MIGRATION_ONLY", project_ref: manifest.project_ref, migration_version: "0040", migration_sha256: manifest.migration_0040_sha256, review_package_sha256: binding, source_commit: head, function_deployment_authorized: false, traffic_authorized: false, provider_calls_allowed: 0, ...time };
validateMigrationRequest(migration, manifest, head, now);
assert.throws(() => validateMigrationRequest({ ...migration, function_deployment_authorized: true }, manifest, head, now));
const acceptedManifest = { ...manifest, accepted_dice_evidence_sha256: "e".repeat(64) };
const traffic = { schema: "s2_t286_chat_synthetic_traffic_request_v1", authority: "CHAT_SYNTHETIC_CLOSED_FIXTURE_WINDOW_ONLY", project_ref: manifest.project_ref, function_name: manifest.function_name, review_package_sha256: binding, source_commit: head, accepted_dice_evidence_sha256: "e".repeat(64), deployment_receipt_sha256: "1".repeat(64), migration_0040_receipt_sha256: "2".repeat(64), fixture_count: 60, language_counts: { en: 30, zh_hant: 30 }, runtime_request_fields: ["fixture_id"], normal_chat_connected: false, member_context: false, threads: false, messages: false, persistence_writes: 0, units_charged: 0, ...time };
validateTrafficRequest(traffic, acceptedManifest, head, now);
assert.throws(() => validateTrafficRequest(traffic, manifest, head, now));
assert.throws(() => validateTrafficRequest({ ...traffic, messages: true }, acceptedManifest, head, now));

const changed = execFileSync("git", ["diff", "--name-only", manifest.base_commit], { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
for (const file of changed) assert.doesNotMatch(file, /^supabase\/functions\/chat-message\/|^apps\/mobile\/src\/(?:features\/chat|services\/chat\.ts)/);
console.log(`S2_T286_CHAT_CONTRACT_OK package=${binding} dice=${dice.schema} files=${Object.keys(manifest.source_sha256).length}`);
