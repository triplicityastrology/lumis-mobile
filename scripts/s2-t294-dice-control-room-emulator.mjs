import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

import { STOP, createJournal, exportSha, loadControl, runControlRoom, writeJournal } from "./lib/s2-t294-dice-control-room.mjs";

const { control, t289, registry } = loadControl();
const now = Date.now();
const runId = "dice-tech80-t294emulator0001";
const receipts = {
  deployment: { schema: "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1", authorization_schema: t289.deployment.schema, project_ref: t289.project_ref, function_name: t289.function_name, deployment_id: "dice-deploy-t294emulator0001", source_commit: t289.deployment.authority_commit, runtime_package_sha256: t289.deployment.runtime_package_sha256, disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" }, provider_calls: 0, model_invocations: 0, kill_switch_disabled: true, traffic_switch_disabled: true, migration_applied: false, deployed_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString() },
  migration: { schema: "s2_t289_accepted_t283_migration_0039_receipt_v1", authorization_scope: t289.migration.authorization_scope, project_ref: t289.project_ref, migration_version: "0039", migration_sha256: t289.migration.migration_sha256, proof_commit: t289.migration.proof_commit, proof_receipt_schema: t289.migration.proof_receipt_schema, proof_receipt_sha256: t289.migration.proof_receipt_sha256, applied: true, parity_verified: true, rpc_rls_verified: true, concurrency_replay_caps_verified: true, cleanup_verified: true, provider_calls: 0, issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString() },
  traffic: { schema: "lumis_dice_technical_synthetic_window_80_authorization_v1", issuer: "Microsoft", decision: "AUTHORIZED", authorization_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY", single_use_run_id: runId, deployment_id: "dice-deploy-t294emulator0001", migration_version: "0039", runtime_package_sha256: t289.deployment.runtime_package_sha256, migration_proof_receipt_sha256: t289.migration.proof_receipt_sha256, registry_sha256: t289.registry.payload_sha256, technical_cases: 80, language: { en: 40, "zh-Hant": 40 }, founder_cases: 0, attempt_cap: 160, concurrency: 2, eligible_retries: 1, shared_deadline_ms: 12000, input_token_cap: 800, output_token_cap: 300, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128, issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(), signature_algorithm: "Ed25519", microsoft_signature_base64: `${"A".repeat(86)}==` },
};

const root = ".tmp/s2-t294-emulator"; rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
const journalPath = `${root}/journal.json`; let disabled = true; let active = 0; let peak = 0; let protocolAttempts = 0;
const gateway = {
  async status() { return { interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: !disabled, provider_access: !disabled, route_default_off: true, active_run_id: disabled ? null : runId }; },
  async executeFixture({ run_id, fixture_id }) { disabled = false; active += 1; peak = Math.max(peak, active); assert(active <= 2); const fixture = registry.fixtures.find((item) => item.fixture_id === fixture_id); const index = registry.fixtures.indexOf(fixture); const safety = /SAFETY|DEFAULT-V2/.test(fixture_id); const excluded = fixture_id.includes("EXCLUDED"); const retry = /TRANSIENT|RETRY/.test(fixture_id); const attempts = safety || excluded ? 0 : retry ? 2 : 1; protocolAttempts += attempts; await new Promise((resolve) => setTimeout(resolve, index % 2)); active -= 1; const observed = new Date(now + index).toISOString(); return { schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id, fixture_id, phase: "technical", language: fixture.language, result_class: safety ? "safety" : excluded ? "excluded" : "completed", attempt_count: attempts, input_tokens: 320 + index, output_tokens: safety || excluded ? 0 : 120 + index % 40, duration_ms: 20 + index, concurrency_peak: Math.max(1, peak), redacted_failure_code: safety ? (fixture_id.includes("DEFAULT-V2") ? "defaultv2_block" : "safety_block") : excluded ? "scope_excluded" : "none", observed_at: observed, retain_until: new Date(Date.parse(observed) + 30 * 86_400_000).toISOString(), effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 } }; },
  async disable() { disabled = true; }, async killRequested() { return false; },
};
const progress = [];
const result = await runControlRoom({ gateway, receipts, journalPath, onProgress: (summary) => progress.push(summary) });
assert.equal(result.summary.completed, 80); assert.equal(result.summary.remaining, 0); assert(result.summary.attempts <= 160); assert.equal(result.summary.concurrency_limit, 2); assert(result.summary.cost_usd <= 0.128); assert.equal(result.summary.provider_disabled_verified, true); assert.equal(disabled, true); assert.equal(result.export.rows.length, 80); assert.equal(result.export.live_azure_proof, false); assert.equal(protocolAttempts, result.export.rows.reduce((sum, row) => sum + row.attempts, 0));
const exportText = `${JSON.stringify(result.export, null, 2)}\n`; writeFileSync(`${root}/redacted-review.json`, exportText); writeFileSync(`${root}/rehearsal-summary.json`, `${JSON.stringify({ evidence_class: "local_zero_network_rehearsal_only", cases: 80, en: 40, zh_hant: 40, attempts: protocolAttempts, peak_concurrency: peak, cost_usd: result.summary.cost_usd, provider_disabled_verified: true, remote_calls: 0, export_sha256: exportSha(result.export) }, null, 2)}\n`);
const attemptsBeforeResume = protocolAttempts;
const resumed = await runControlRoom({ gateway, receipts, journalPath });
assert.equal(resumed.summary.completed, 80); assert.equal(protocolAttempts, attemptsBeforeResume, "completed attempts must not repeat on resume");

const ambiguousPath = `${root}/ambiguous.json`; const ambiguous = createJournal({ traffic: receipts.traffic, registry, now });
ambiguous.records[0].state = "running"; ambiguous.records[0].attempts.push({ attempt_id: "attempt-11111111-1111-4111-8111-111111111111", ordinal: 1, state: "dispatched", reserved_at: new Date(now).toISOString(), completed_at: null, evidence: null }); writeJournal(ambiguousPath, ambiguous);
const callsBeforeAmbiguous = protocolAttempts;
await assert.rejects(() => runControlRoom({ gateway, receipts, journalPath: ambiguousPath }), (error) => error.code === STOP.ambiguous);
assert.equal(protocolAttempts, callsBeforeAmbiguous, "ambiguous dispatched attempts must never be repeated");

const killedPath = `${root}/killed.json`; const killed = createJournal({ traffic: receipts.traffic, registry, now }); killed.kill_requested = true; writeJournal(killedPath, killed);
await assert.rejects(() => runControlRoom({ gateway, receipts, journalPath: killedPath }), (error) => error.code === STOP.killed);
assert.equal(disabled, true, "kill path must disable and verify before returning");
console.log(`S2_T294_ZERO_NETWORK_REHEARSAL_OK cases=80 en=40 zh_hant=40 attempts=${protocolAttempts} peak=${peak} cost_usd=${result.summary.cost_usd} remote_calls=0 export_sha256=${exportSha(result.export)}`);
