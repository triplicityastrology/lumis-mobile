import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadAndValidateControl, runTechnicalWindow, sha256, validateEvidencePackage } from "./lib/s2-t289-dice-technical-window.mjs";

const { control, registry } = loadAndValidateControl();
const now = Date.now();
const runId = "dice-tech80-localemulatorv4001";
const deploymentReceipt = {
  schema: "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1", authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  project_ref: control.project_ref, function_name: control.function_name, deployment_id: "dice-deploy-localemulatorv4001", source_commit: control.deployment.authority_commit,
  runtime_package_sha256: control.deployment.runtime_package_sha256, disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
  provider_calls: 0, model_invocations: 0, kill_switch_disabled: true, traffic_switch_disabled: true, migration_applied: false,
  deployed_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(),
};
const migrationReceipt = {
  schema: "s2_t289_accepted_t283_migration_0039_receipt_v1", authorization_scope: "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY", project_ref: control.project_ref,
  migration_version: "0039", migration_sha256: control.migration.migration_sha256, proof_commit: control.migration.proof_commit,
  proof_receipt_schema: control.migration.proof_receipt_schema, proof_receipt_sha256: control.migration.proof_receipt_sha256,
  applied: true, parity_verified: true, rpc_rls_verified: true, concurrency_replay_caps_verified: true, cleanup_verified: true, provider_calls: 0,
  issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(),
};
const trafficAuthority = {
  schema: "lumis_dice_technical_synthetic_window_80_authorization_v1", issuer: "Microsoft", decision: "AUTHORIZED", authorization_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  single_use_run_id: runId, deployment_id: deploymentReceipt.deployment_id, migration_version: "0039", runtime_package_sha256: control.deployment.runtime_package_sha256,
  migration_proof_receipt_sha256: control.migration.proof_receipt_sha256, registry_sha256: control.registry.payload_sha256,
  technical_cases: 80, language: { en: 40, "zh-Hant": 40 }, founder_cases: 0, attempt_cap: 160, concurrency: 2, eligible_retries: 1,
  shared_deadline_ms: 12000, input_token_cap: 800, output_token_cap: 300, tokenizer: "js-tiktoken@1.0.21/o200k_base", cost_ceiling_usd: 0.128,
  issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(), signature_algorithm: "Ed25519", microsoft_signature_base64: `${"A".repeat(86)}==`,
};

let disabled = true; let active = 0; let peak = 0; let protocolAttempts = 0;
const gateway = {
  async status() { return { interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: !disabled, provider_access: !disabled, route_default_off: true, active_run_id: disabled ? null : runId }; },
  async executeAuthorizedWindow(request) {
    assert.equal(request.run_id, runId); assert.equal(request.fixture_ids.length, 80); disabled = false;
    const records = new Array(80); let cursor = 0; let attemptTotal = 0;
    const worker = async () => { while (true) {
      const index = cursor++; if (index >= 80) return;
      const fixture = registry.fixtures[index]; active += 1; peak = Math.max(peak, active); assert(active <= 2);
      await new Promise((resolve) => setTimeout(resolve, index % 3)); active -= 1;
      const safety = /SAFETY|DEFAULT-V2/.test(fixture.fixture_id); const excluded = fixture.fixture_id.includes("EXCLUDED"); const retry = /TRANSIENT|RETRY/.test(fixture.fixture_id);
      const attempts = safety || excluded ? 0 : retry ? 2 : 1; protocolAttempts += attempts; attemptTotal += attempts;
      const observed = new Date(now + index).toISOString();
      records[index] = { schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: runId, fixture_id: fixture.fixture_id, phase: "technical", language: fixture.language,
        result_class: safety ? "safety" : excluded ? "excluded" : "completed", attempt_count: attempts, input_tokens: 320 + index, output_tokens: safety || excluded ? 0 : 120 + (index % 40), duration_ms: 20 + index,
        concurrency_peak: peak, redacted_failure_code: safety ? (fixture.fixture_id.includes("DEFAULT-V2") ? "defaultv2_block" : "safety_block") : excluded ? "scope_excluded" : "none",
        observed_at: observed, retain_until: new Date(Date.parse(observed) + 30 * 86_400_000).toISOString(), effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 } };
    }};
    try { await Promise.all([worker(), worker()]); return { schema: "lumis_dice_synthetic_metadata_evidence_package_v1", run_id: runId, technical_case_count: 80, founder_case_count: 0, attempt_total: attemptTotal, tokenizer_vocabulary: "o200k_base", provider_disabled_verified: true, records }; }
    finally { disabled = true; }
  },
};

const evidence = await runTechnicalWindow({ gateway, deploymentReceipt, migrationReceipt, trafficAuthority, claimRun: async () => true });
validateEvidencePackage(evidence);
assert.equal(evidence.technical_case_count, 80); assert.deepEqual(evidence.language, { en: 40, "zh-Hant": 40 }); assert(evidence.attempt_total <= 160);
assert.equal(evidence.concurrency_peak, 2); assert.equal(disabled, true); assert.equal(protocolAttempts, evidence.attempt_total);
const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
const qa = { schema: "s2_t289_dice_technical_qa_bundle_v1", evidence_class: "local_zero_network_emulator_only", grants_remote_authority: false,
  runtime_package_sha256: control.deployment.runtime_package_sha256, migration_proof_receipt_sha256: control.migration.proof_receipt_sha256, registry_sha256: control.registry.payload_sha256,
  evidence_sha256: sha256(evidenceText), technical_cases: 80, founder_cases: 0, language: evidence.language, attempts: evidence.attempt_total, concurrency_peak: evidence.concurrency_peak,
  provider_disabled_verified: true, provider_calls_remote: 0, local_protocol_attempts: protocolAttempts, network_calls: 0, effects: evidence.effects };
mkdirSync(".tmp/s2-t289", { recursive: true }); writeFileSync(".tmp/s2-t289/local-emulator-evidence.json", evidenceText); writeFileSync(".tmp/s2-t289/local-emulator-qa-bundle.json", `${JSON.stringify(qa, null, 2)}\n`);
console.log(`S2_T289_LOCAL_EMULATOR_OK cases=80 en=40 zh_hant=40 attempts=${evidence.attempt_total} concurrency=2 remote_calls=0 evidence_sha256=${qa.evidence_sha256}`);
