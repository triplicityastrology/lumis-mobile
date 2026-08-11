import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadAndValidateControl, runTechnicalWindow, sha256, validateEvidencePackage } from "./lib/s2-t275-dice-technical-window.mjs";

const { control, registry } = loadAndValidateControl();
const now = Date.now();
const runId = "dice-tech80-localemulator001";
const deploymentReceipt = {
  schema: "s2_t275_accepted_default_off_deployment_receipt_v1", project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic",
  deployment_id: "dice-deploy-localemulator001", source_commit: control.base_commit, package_sha256: control.gateway_package_sha256,
  provider_calls: 0, disabled_verified: true, issued_at: new Date(now - 1000).toISOString(), expires_at: new Date(now + 60000).toISOString(),
};
const trafficAuthority = {
  schema: "s2_t275_dice_technical_traffic_authorization_v1", authorization_scope: "technical_80_only", single_use_run_id: runId,
  deployment_id: deploymentReceipt.deployment_id, source_commit: control.base_commit, package_sha256: control.gateway_package_sha256,
  technical_cases: 80, founder_cases: 0, attempt_cap: 160, cost_ceiling_usd: 0.128,
  issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60000).toISOString(), microsoft_review: "accepted",
  gateway_authorization: {
    schema: "lumis_dice_default_off_deployment_authorization_v2", interface_version: "dice_synthetic_gateway_port_v1", authorization_scope: "technical_80_only",
    single_use_run_id: runId, issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60000).toISOString(),
    gateway_package_sha256: control.gateway_package_sha256, fixture_registry_sha256: control.registry_sha256, technical_case_count: 80, founder_execution: false,
    authorization_hmac_sha256: "b".repeat(64),
  },
};

let disabled = true;
let active = 0;
let peak = 0;
let invocationOrder = 0;
let localProtocolAttempts = 0;
const gateway = {
  async status() { return { interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: !disabled, provider_access: !disabled, route_default_off: true, active_run_id: disabled ? null : runId }; },
  async executeAuthorizedWindow(authorization) {
    assert.deepEqual(authorization, trafficAuthority.gateway_authorization); disabled = false;
    const records = new Array(80); let cursor = 0, attemptTotal = 0;
    const worker = async () => { while (true) {
    const index = cursor++; if (index >= registry.fixtures.length) return;
    const { fixture_id } = registry.fixtures[index];
    const fixture = registry.fixtures[index];
    assert(fixture && fixture.phase === "technical" && !fixture_id.includes("FOUNDER"));
    active += 1; peak = Math.max(peak, active); invocationOrder += 1;
    assert(active <= 2);
    await new Promise((resolve) => setTimeout(resolve, index % 3));
    active -= 1;
    const isSafety = fixture_id.includes("SAFETY") || fixture_id.includes("DEFAULT-V2");
    const isExcluded = fixture_id.includes("EXCLUDED");
    const retry = fixture_id.includes("TRANSIENT") || fixture_id.includes("RETRY");
    const attemptCount = isSafety || isExcluded ? 0 : retry ? 2 : 1;
    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      const protocolRequest = {
        method: "POST",
        url: "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com/openai/v1/responses",
        model: "lumis-ai-chat-stg",
        fixture_id,
        max_output_tokens: 300,
        store: false,
      };
      assert.deepEqual(Object.keys(protocolRequest).sort(), ["fixture_id", "max_output_tokens", "method", "model", "store", "url"]);
      assert.equal(protocolRequest.url, "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com/openai/v1/responses");
      assert.equal(protocolRequest.store, false);
      localProtocolAttempts += 1;
    }
    attemptTotal += attemptCount;
    const observedAt = new Date(now + index).toISOString();
    records[index] = {
      schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: runId, fixture_id, phase: "technical", language: fixture.language,
      result_class: isSafety ? "safety" : isExcluded ? "excluded" : "completed",
      attempt_count: attemptCount,
      input_tokens: 320 + (index % 80), output_tokens: isSafety || isExcluded ? 0 : 120 + (index % 40), duration_ms: 20 + index,
      concurrency_peak: peak, redacted_failure_code: isSafety ? (fixture_id.includes("DEFAULT-V2") ? "defaultv2_block" : "safety_block") : isExcluded ? "scope_excluded" : "none",
      observed_at: observedAt, retain_until: new Date(Date.parse(observedAt) + 30 * 86_400_000).toISOString(),
      effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 },
    };
    }};
    try { await Promise.all([worker(), worker()]); return { schema: "lumis_dice_synthetic_metadata_evidence_package_v1", run_id: runId, technical_case_count: 80, founder_case_count: 0, attempt_total: attemptTotal, tokenizer_vocabulary: "o200k_base", provider_disabled_verified: true, records }; }
    finally { disabled = true; }
  },
};

const evidence = await runTechnicalWindow({ gateway, deploymentReceipt, trafficAuthority, claimRun: async () => true });
validateEvidencePackage(evidence);
assert.equal(invocationOrder, 80);
assert.equal(evidence.records.length, 80);
assert.equal(evidence.language.en, 40);
assert.equal(evidence.language["zh-Hant"], 40);
assert(evidence.attempt_total <= 160);
assert.equal(evidence.concurrency_peak, 2);
assert.equal(disabled, true);
assert.equal(evidence.provider_disabled_verified, true);
assert.equal(evidence.founder_case_count, 0);

const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`;
const qa = {
  schema: "s2_t275_dice_technical_qa_bundle_v1",
  evidence_class: "local_zero_network_emulator_only",
  grants_remote_authority: false,
  source_commit: control.base_commit,
  package_sha256: control.gateway_package_sha256,
  evidence_sha256: sha256(evidenceJson),
  technical_cases: 80,
  founder_cases: 0,
  language: evidence.language,
  attempts: evidence.attempt_total,
  concurrency_peak: evidence.concurrency_peak,
  provider_disabled_verified: evidence.provider_disabled_verified,
  provider_calls_remote: 0,
  local_protocol_attempts: localProtocolAttempts,
  network_calls: 0,
  effects: evidence.effects,
};
mkdirSync(".tmp/s2-t275", { recursive: true });
writeFileSync(".tmp/s2-t275/local-emulator-evidence.json", evidenceJson);
writeFileSync(".tmp/s2-t275/local-emulator-qa-bundle.json", `${JSON.stringify(qa, null, 2)}\n`);
assert.equal(localProtocolAttempts, evidence.attempt_total);
console.log(`S2_T275_LOCAL_EMULATOR_OK cases=80 attempts=${evidence.attempt_total} concurrency=${evidence.concurrency_peak} remote_calls=0 evidence_sha256=${qa.evidence_sha256}`);
