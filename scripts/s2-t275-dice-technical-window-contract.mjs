import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  STOP, TechnicalWindowStop, loadAndValidateControl, runTechnicalWindow, sha256,
  validateDeploymentReceipt, validateEvidencePackage, validateRegistry, validateTrafficAuthority,
} from "./lib/s2-t275-dice-technical-window.mjs";

const { control, registry } = loadAndValidateControl();
assert.equal(control.scope.technical_cases, 80);
assert.equal(control.scope.founder_cases, 0);
assert.equal(control.limits.attempts, 160);
assert.equal(control.limits.concurrency, 2);
assert.equal(control.limits.shared_case_deadline_ms, 12000);
assert.equal(control.limits.technical_cost_ceiling_usd, 0.128);
assert.equal(registry.fixtures.filter((item) => item.language === "en").length, 40);
assert.equal(registry.fixtures.filter((item) => item.language === "zh-Hant").length, 40);

const now = Date.now();
const deployment = {
  schema: "s2_t275_accepted_default_off_deployment_receipt_v1",
  project_ref: "bmqhwofmdgebpcihjlnb",
  function_name: "dice-synthetic",
  deployment_id: "dice-deploy-technicalwindow01",
  source_commit: control.base_commit,
  package_sha256: control.gateway_package_sha256,
  provider_calls: 0,
  disabled_verified: true,
  issued_at: new Date(now - 1000).toISOString(),
  expires_at: new Date(now + 60000).toISOString(),
};
const traffic = {
  schema: "s2_t275_dice_technical_traffic_authorization_v1",
  authorization_scope: "technical_80_only",
  single_use_run_id: "dice-tech80-contractproof0001",
  deployment_id: deployment.deployment_id,
  source_commit: control.base_commit,
  package_sha256: control.gateway_package_sha256,
  technical_cases: 80,
  founder_cases: 0,
  attempt_cap: 160,
  cost_ceiling_usd: 0.128,
  issued_at: new Date(now - 1000).toISOString(),
  valid_until: new Date(now + 60000).toISOString(),
  microsoft_review: "accepted",
  gateway_authorization: {
    schema: "lumis_dice_default_off_deployment_authorization_v2", interface_version: "dice_synthetic_gateway_port_v1", authorization_scope: "technical_80_only",
    single_use_run_id: "dice-tech80-contractproof0001", issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60000).toISOString(),
    gateway_package_sha256: control.gateway_package_sha256, fixture_registry_sha256: control.registry_sha256, technical_case_count: 80, founder_execution: false,
    authorization_hmac_sha256: "a".repeat(64),
  },
};
validateDeploymentReceipt(deployment, control, now);
validateTrafficAuthority(traffic, control, deployment, now);

const reject = async (code, action) => assert.rejects(action, (error) => error instanceof TechnicalWindowStop && error.code === code);
for (const mutation of [
  (value) => { value.project_ref = "wrong"; },
  (value) => { value.package_sha256 = "a".repeat(64); },
  (value) => { value.provider_calls = 1; },
  (value) => { value.extra = true; },
]) {
  const value = structuredClone(deployment); mutation(value);
  assert.throws(() => validateDeploymentReceipt(value, control, now), (error) => error.code === STOP.deployment);
}
for (const mutation of [
  (value) => { value.founder_cases = 40; },
  (value) => { value.technical_cases = 81; },
  (value) => { value.attempt_cap = 161; },
  (value) => { value.cost_ceiling_usd = 0.129; },
  (value) => { value.microsoft_review = "pending"; },
  (value) => { value.extra = true; },
]) {
  const value = structuredClone(traffic); mutation(value);
  assert.throws(() => validateTrafficAuthority(value, control, deployment, now), (error) => error.code === STOP.traffic);
}

assert.throws(() => validateRegistry([...registry.fixtures, { fixture_id: "DICE-FOUNDER-EN-01", language: "en", phase: "founder" }]), (error) => error.code === STOP.registry);

function gateway(overrides = {}) {
  let disabled = true, executions = 0;
  return {
    get executions() { return executions; },
    async status() { return { interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: !disabled, provider_access: !disabled, route_default_off: true, active_run_id: disabled ? null : traffic.single_use_run_id }; },
    async executeAuthorizedWindow(authorization) {
      executions += 1; disabled = false;
      try {
        assert.deepEqual(authorization, traffic.gateway_authorization);
        if (overrides.throwRun) throw new Error("redacted");
        const observed = new Date(now).toISOString(), retained = new Date(now + 30 * 86_400_000).toISOString();
        const records = registry.fixtures.map((fixture) => ({
          schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: traffic.single_use_run_id, fixture_id: fixture.fixture_id, phase: "technical", language: fixture.language,
          result_class: "completed", attempt_count: 1, input_tokens: 400, output_tokens: 150, duration_ms: 25, concurrency_peak: 2, redacted_failure_code: "none",
          observed_at: observed, retain_until: retained, effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 },
        }));
        return { schema: "lumis_dice_synthetic_metadata_evidence_package_v1", run_id: traffic.single_use_run_id, technical_case_count: 80, founder_case_count: 0, attempt_total: 80, tokenizer_vocabulary: "o200k_base", provider_disabled_verified: true, records };
      } finally { if (!overrides.postBad) disabled = true; }
    },
  };
}

const successGateway = gateway();
const success = await runTechnicalWindow({ gateway: successGateway, deploymentReceipt: deployment, trafficAuthority: traffic, claimRun: async () => true });
validateEvidencePackage(success);
assert.equal(successGateway.executions, 1);
assert.equal(success.technical_case_count, 80);
assert.equal(success.founder_case_count, 0);
assert.equal(success.attempt_total, 80);
assert.equal(success.language.en, 40);
assert.equal(success.language["zh-Hant"], 40);
assert.equal(success.cost_ceiling_usd, 0.128);
assert.equal(new Set(success.records.map((item) => item.fixture_id)).size, 80);
assert(!JSON.stringify(success).match(/question|prompt|response|member_id|api_key|secret/i));

await reject(STOP.replay, () => runTechnicalWindow({ gateway: gateway(), deploymentReceipt: deployment, trafficAuthority: traffic, claimRun: async () => false }));
const failedGateway = gateway({ throwRun: true });
await assert.rejects(() => runTechnicalWindow({ gateway: failedGateway, deploymentReceipt: deployment, trafficAuthority: traffic }));
assert.equal(failedGateway.executions, 1, "sealed gateway executed exactly once before its finally-disable");
await reject(STOP.disable, () => runTechnicalWindow({ gateway: gateway({ postBad: true }), deploymentReceipt: deployment, trafficAuthority: traffic }));

const defaultRun = spawnSync(process.execPath, ["scripts/s2-t275-dice-technical-window.mjs"], { encoding: "utf8" });
assert.equal(defaultRun.status, 2);
assert.equal(JSON.parse(defaultRun.stdout).status, STOP.deployment);
assert.equal(JSON.parse(defaultRun.stdout).provider_calls, 0);

const schema = JSON.parse(readFileSync("supabase/tests/s2-t275-dice-technical-evidence-package.schema.json", "utf8"));
assert.equal(schema.additionalProperties, false);
assert.equal(schema.properties.technical_case_count.const, 80);
assert.equal(schema.properties.founder_case_count.const, 0);
assert.equal(schema.properties.cost_ceiling_usd.const, 0.128);
assert.equal(schema.$defs.record.additionalProperties, false);
for (const path of ["supabase/tests/s2-t275-default-off-deployment-receipt.schema.json", "supabase/tests/s2-t275-technical-traffic-authorization.schema.json", "supabase/tests/s2-t275-technical-qa-bundle.schema.json"]) {
  assert.equal(JSON.parse(readFileSync(path, "utf8")).additionalProperties, false);
}
const guide = readFileSync("docs/qa/S2-T275-dice-technical-window.md", "utf8");
assert.match(guide, /NO_AZURE_TRAFFIC_AUTHORITY/);
assert.match(guide, /finally/i);
assert(!guide.includes("$0.48"));
assert.equal(sha256(readFileSync("config/s2-t262-dice-technical-registry-v1.json")), control.registry_file_sha256);
const manifest = JSON.parse(readFileSync("config/s2-t275-dice-technical-window-manifest.json", "utf8"));
assert.equal(manifest.schema, "s2_t275_dice_technical_window_manifest_v1");
assert.equal(manifest.base_commit, control.base_commit);
assert.equal(manifest.gateway_package_sha256, control.gateway_package_sha256);
for (const [path, expected] of Object.entries(manifest.files)) assert.equal(sha256(readFileSync(path)), expected, `T275 sealed drift: ${path}`);

execFileSync(process.execPath, ["scripts/s2-t267-dice-edge-release-contract.mjs"], { stdio: "pipe" });
console.log(`S2_T275_DICE_TECHNICAL_WINDOW_CONTRACT_OK cases=${success.records.length} attempts=${success.attempt_total} cost_cap=${success.cost_ceiling_usd}`);
