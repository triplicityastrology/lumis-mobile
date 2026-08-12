#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  AUTHORITY, MIGRATION_SCOPE, TRAFFIC_SCOPE, T314_COMMIT, T314_PACKAGE, canonical, loadBuiltInCandidate, loadControl, unsignedPayload,
  validateCandidate, validateDeploymentPostReceipt, validateMigrationAuthorization, validateMigrationPostReceipt,
  validateProofRecord, validateTrafficAuthorization, validateTrafficPostReceipt
} from "./lib/s2-t315-authorization-day.mjs";

const control = loadControl();
const proof = validateProofRecord();
assert.equal(proof.proof_receipt_sha256, "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e");
assert.deepEqual(control.authority_status, AUTHORITY);
const seal = JSON.parse(readFileSync("config/s2-t315-authorization-day-package-seal.json", "utf8"));
assert.equal(seal.schema, "s2_t315_authorization_day_package_seal_v1");
for (const [path, expected] of Object.entries(seal.files)) assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), expected, `sealed drift: ${path}`);
assert.equal(createHash("sha256").update(Object.entries(seal.files).map(([path, digest]) => `${path}:${digest}\n`).join("")).digest("hex"), seal.package_sha256);
for (const path of ["supabase/tests/s2-t315-migration-0039-authorization.schema.json","supabase/tests/s2-t315-technical-80-authorization.schema.json","supabase/tests/s2-t315-post-action-receipts.schema.json"]) {
  const schema = JSON.parse(readFileSync(path, "utf8"));
  assert(schema.additionalProperties === false || schema.oneOf, path);
}

const candidate = loadBuiltInCandidate();
assert.equal(candidate.candidate_commit, T314_COMMIT);
assert.equal(candidate.candidate_package_sha256, T314_PACKAGE);
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const fingerprint = createHash("sha256").update(publicKey.export({ type: "spki", format: "der" })).digest("hex");
const now = Date.now();
const signed = (value) => ({ ...value, issuer_signature_base64: sign(null, unsignedPayload({ ...value, issuer_signature_base64: "" }), privateKey).toString("base64") });
// Signature excludes the signature field entirely.
const attach = (value) => { const copy = structuredClone(value); delete copy.issuer_signature_base64; return { ...copy, issuer_signature_base64: sign(null, Buffer.from(canonical(copy)), privateKey).toString("base64") }; };

const testTrustAnchor = { keyId: "founder-ed25519-deployment-approver-v1", spkiSha256: fingerprint };
const common = { issuer: "Lumis Founder Deployment Approver", issuer_key_id: testTrustAnchor.keyId, issuer_public_key_spki_sha256: fingerprint, trust_anchor_owner: "Founder", decision: "AUTHORIZED", project_ref: "bmqhwofmdgebpcihjlnb", candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, issued_at: new Date(now - 5_000).toISOString(), expires_at: new Date(now + 600_000).toISOString() };
const migration = attach({ schema: "lumis_dice_authority_ledger_0039_migration_authorization_v3", ...common, scope: MIGRATION_SCOPE, authorization_id: "dice-0039-contractauthorization01", migration_version: "0039", migration_sha256: control.migration.sha256, proof_commit: control.migration.proof_commit, proof_receipt_sha256: control.migration.proof_receipt_sha256, authorized_action: "APPLY_0039", function_deployment_authorized: false, provider_traffic_authorized: false, normal_chat_integration_authorized: false });
const migrationAccepted = validateMigrationAuthorization(migration, candidate, publicPem, now, "APPLY_0039", testTrustAnchor);
assert.equal(migrationAccepted.scope, MIGRATION_SCOPE);
const migrationReceipt = { schema: "s2_t315_migration_0039_post_action_receipt_v1", scope: MIGRATION_SCOPE, project_ref: control.project_ref, migration_version: "0039", migration_sha256: control.migration.sha256, candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, action: "APPLY_0039", applied: true, zero_residue_verified: false, parity_verified: true, rpc_rls_verified: true, cleanup_verified: true, provider_calls: 0, function_deployments: 0, normal_chat_integrations: 0, recorded_at: new Date(now).toISOString() };
const migrationPost = validateMigrationPostReceipt(migrationReceipt, candidate);
assert.equal(validateMigrationPostReceipt({ ...migrationReceipt, action: "ROLLBACK_0039", applied: false, zero_residue_verified: true }, candidate).value.applied, false);

const deploymentReceipt = { schema: "s2_t314_post_deploy_disabled_receipt_v1", project_ref: control.project_ref, function_name: "dice-synthetic", candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, deployment_id: "dice-deploy-contractdisabled01", disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" }, both_switches_false: true, provider_calls: 0, model_invocations: 0, migration_applied: false, normal_chat_unchanged: true, recorded_at: new Date(now).toISOString() };
assert.match(validateDeploymentPostReceipt(deploymentReceipt, candidate).digest, /^[a-f0-9]{64}$/u);

const traffic = attach({ schema: "lumis_dice_technical_synthetic_window_80_authorization_v2", ...common, scope: TRAFFIC_SCOPE, authorization_id: "dice-tech80-contractauthorization01", run_id: "dice-tech80-contractrun00000001", function_name: "dice-synthetic", accepted_post_deploy_receipt_sha256: "c".repeat(64), accepted_migration_0039_receipt_sha256: migrationPost.digest, technical_cases: 80, language: { en: 40, "zh-Hant": 40 }, founder_cases: 0, attempt_cap: 160, concurrency: 2, eligible_retries: 1, shared_deadline_ms: 12000, input_token_cap: 800, output_token_cap: 300, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128, migration_authorized: false, function_deployment_authorized: false, normal_chat_integration_authorized: false });
assert.equal(validateTrafficAuthorization(traffic, candidate, publicPem, now, testTrustAnchor).scope, TRAFFIC_SCOPE);
const trafficReceipt = { schema: "s2_t315_technical_80_post_action_receipt_v1", scope: TRAFFIC_SCOPE, project_ref: control.project_ref, function_name: "dice-synthetic", candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, run_id: traffic.run_id, cases: 80, language: { en: 40, "zh-Hant": 40 }, attempts: 120, concurrency_peak: 2, cost_usd: 0.08, cost_ceiling_usd: 0.128, provider_disabled_verified: true, founder_cases: 0, units_charged: 0, persistence_writes: 0, recorded_at: new Date(now).toISOString() };
assert.match(validateTrafficPostReceipt(trafficReceipt, candidate).digest, /^[a-f0-9]{64}$/u);

for (const [name, mutate, validate, expected] of [
  ["migration-cross-scope", (v) => { v.scope = TRAFFIC_SCOPE; }, (v) => validateMigrationAuthorization(v, candidate, publicPem, now, v.authorized_action, testTrustAnchor), "STOP_S2_T315_MIGRATION_AUTHORIZATION_INVALID"],
  ["migration-enables-traffic", (v) => { v.provider_traffic_authorized = true; }, (v) => validateMigrationAuthorization(v, candidate, publicPem, now, v.authorized_action, testTrustAnchor), "STOP_S2_T315_MIGRATION_AUTHORIZATION_INVALID"],
  ["traffic-cross-scope", (v) => { v.scope = MIGRATION_SCOPE; }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
  ["traffic-81", (v) => { v.technical_cases = 81; }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
  ["traffic-161", (v) => { v.attempt_cap = 161; }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
  ["traffic-concurrency", (v) => { v.concurrency = 3; }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
  ["traffic-founder", (v) => { v.founder_cases = 40; }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
  ["traffic-stale", (v) => { v.expires_at = new Date(now - 1).toISOString(); }, (v) => validateTrafficAuthorization(v, candidate, publicPem, now, testTrustAnchor), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID"],
]) {
  const value = structuredClone(name.startsWith("migration") ? migration : traffic);
  mutate(value);
  assert.throws(() => validate(value), (error) => error.code === expected, name);
}

// A traffic receipt can never validate as migration authority, and vice versa.
assert.throws(() => validateMigrationAuthorization(traffic, candidate, publicPem, now, traffic.authorized_action, testTrustAnchor), (error) => error.code === "STOP_S2_T315_MIGRATION_AUTHORIZATION_INVALID");
assert.throws(() => validateTrafficAuthorization(migration, candidate, publicPem, now, testTrustAnchor), (error) => error.code === "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID");
assert.throws(() => validateMigrationAuthorization(migration, candidate, publicPem, now), (error) => error.code === "STOP_S2_T315_MIGRATION_AUTHORIZATION_INVALID", "production trust anchor rejects the fixture key");

const migrationRunner = readFileSync("scripts/run-s2-t315-migration-0039.sh", "utf8");
const trafficRunner = readFileSync("scripts/run-s2-t315-technical-80.sh", "utf8");
assert(migrationRunner.indexOf("s2-t315-migration-0039-operator.mjs\" preflight") < migrationRunner.indexOf("S2_T315_DB_HOST"));
assert(trafficRunner.indexOf("s2-t315-technical-80-operator.mjs\" preflight") < trafficRunner.indexOf("s2-t309-dice-80-live-window.mjs\" run"));
assert.match(trafficRunner, /trap cleanup EXIT INT TERM/u);
assert.doesNotMatch(migrationRunner, /supabase functions|services\.ai\.azure\.com|curl /iu);
const statusA = spawnSync(process.execPath, ["scripts/s2-t315-migration-0039-operator.mjs", "status"], { encoding: "utf8" });
const statusB = spawnSync(process.execPath, ["scripts/s2-t315-technical-80-operator.mjs", "status"], { encoding: "utf8" });
assert.equal(JSON.parse(statusA.stdout).remote_calls, 0);
assert.equal(JSON.parse(statusB.stdout).remote_calls, 0);
console.log("S2_T315_AUTHORIZATION_DAY_CONTRACT_OK scopes_separate=true pg17_proof_bound=true remote_calls=0");
