import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OperatorStop, runTechnical80, sha256, STOP, validateControl, validateMicrosoftAuthorization,
  validatePostDeployReceipt, validateTechnicalRegistry, verifySourceSeal, WAITING,
} from "./lib/s2-t259-dice-authorization-operator.mjs";
import { createFileDeploymentClaimAuthority } from "./lib/s2-t259-durable-deployment-claim.mjs";
import {
  DiceGatewayStop, DiceSyntheticGatewayPortV1, signDiceDeploymentAuthorization,
} from "../.tmp/dice-synthetic-port-v1-tests/supabase/functions/_shared/dice-synthetic-gateway-port-v1.js";

if (process.argv[2] === "--claim-worker") {
  try {
    const claim = createFileDeploymentClaimAuthority({ ledgerPath: process.argv[3] });
    console.log(JSON.stringify(await claim({ interface_version: "lumis_dice_deployment_claim_store_v1", deployment_id: process.argv[4] })));
  } catch (error) {
    console.error(error instanceof OperatorStop ? error.code : STOP.claimUnavailable);
    process.exitCode = 2;
  }
  process.exit();
}

const NOW = Date.parse("2026-08-11T08:00:00.000Z");
const SECRET = "test-only-integrated-authority-secret-32-bytes";
const EN_OUTPUT = JSON.stringify({ reading: "Notice the measured opening.", watch_out: "Avoid certainty.", practical_direction: "Take one reversible step." });
const ZH_OUTPUT = JSON.stringify({ reading: "留意較平穩的開端。", watch_out: "避免過早下定論。", practical_direction: "先踏出可以回頭的一步。" });
const control = validateControl(JSON.parse(readFileSync("config/s2-t259-dice-authorization-control.json", "utf8")));
const registry = JSON.parse(readFileSync("config/s2-t262-dice-technical-registry-v1.json", "utf8"));

await verifySourceSeal(control, (path) => readFile(path));
await assert.rejects(() => verifySourceSeal(control, async (path) => path === "package.json" ? Buffer.from("tampered") : readFile(path)), (error) => error.code === STOP.source);
validateTechnicalRegistry(registry, control);
const readonlyEvidenceBytes = readFileSync("config/evidence/s2-t262-azure-foundry-deployment-readonly-v1.json");
assert.equal(sha256(readonlyEvidenceBytes), "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f");
assert.equal(readonlyEvidenceBytes.at(-1), 0x0a);
assert.equal(JSON.parse(readonlyEvidenceBytes).evidence_sha256, null);
const priceEvidenceBytes = readFileSync("config/evidence/s2-t262-azure-foundry-sanitized-price-v1.json");
const priceEvidence = JSON.parse(priceEvidenceBytes);
assert.equal(sha256(priceEvidenceBytes), "2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772");
assert.equal(priceEvidenceBytes.at(-1), 0x0a);
assert.deepEqual(Object.keys(priceEvidence), ["price_sheet_billing_period", "relevant_service_dates", "price_observed_at", "input_price_usd_per_1m_tokens", "output_price_usd_per_1m_tokens", "region_evidence", "currency", "full_maximum_dice_window_estimate_usd", "deployment_alias"]);
assert.equal(priceEvidence.deployment_alias, control.provider_authority.deployment_alias);
const calculatedProviderMaximum = control.technical_limits.attempt_total * (
  control.technical_limits.input_tokens_per_attempt * priceEvidence.input_price_usd_per_1m_tokens
  + control.technical_limits.output_tokens_per_attempt * priceEvidence.output_price_usd_per_1m_tokens
) / 1_000_000;
assert.equal(calculatedProviderMaximum, 0.128);
assert.equal(control.pricing.calculated_provider_maximum_usd, calculatedProviderMaximum);
assert.equal(priceEvidence.full_maximum_dice_window_estimate_usd, 0.192);
assert(priceEvidence.full_maximum_dice_window_estimate_usd >= calculatedProviderMaximum);
assert(priceEvidence.full_maximum_dice_window_estimate_usd <= control.pricing.absolute_window_cap_usd);
assert.equal(control.pricing.azure_api_version, null);
const apiRouteEvidenceBytes = readFileSync("config/evidence/s2-t262-azure-foundry-api-route-family-v1.json");
const apiRouteEvidence = JSON.parse(apiRouteEvidenceBytes);
assert.equal(sha256(apiRouteEvidenceBytes), "2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e");
assert.equal(apiRouteEvidenceBytes.at(-1), 0x0a);
assert.deepEqual(Object.keys(apiRouteEvidence), ["api_route_family", "evidence_method", "observed_at", "explicitly_excluded"]);
assert.equal(apiRouteEvidence.api_route_family, "v1");
assert.equal(control.api_route_evidence.official_reference.url.startsWith("https://learn.microsoft.com/"), true);
assert.equal(sha256(control.api_route_evidence.official_reference.url), control.api_route_evidence.official_reference.url_sha256);
for (const hostile of [
  { ...registry, fixtures: [...registry.fixtures, registry.fixtures[0]] },
  { ...registry, fixtures: registry.fixtures.slice(0, 79) },
  { ...registry, fixtures: registry.fixtures.map((item, index) => index ? item : { ...item, fixture_id: "DICE-FOUNDER-EN-01" }) },
]) assert.throws(() => validateTechnicalRegistry(hostile, control), OperatorStop);

const defaultRun = spawnSync(process.execPath, ["scripts/s2-t259-dice-authorization-operator.mjs"], { encoding: "utf8" });
assert.equal(defaultRun.status, 0);
assert.deepEqual(JSON.parse(defaultRun.stdout), {
  status: WAITING, project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic", provider_calls: 0,
  network_calls: 0, deployment_calls: 0, founder_cases_run: 0,
  next_action: "Await explicit deployment and Azure traffic authority; candidate remains default-off before provider/client construction.",
});

const manifestBase = {
  schema: "lumis_dice_microsoft_deployment_manifest_v1", issuer: "Microsoft",
  decision: "AUTHORIZED_DEFAULT_OFF_DEPLOYMENT", project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic",
  single_use_deployment_id: "dice-deploy-20260811technical", issued_at: "2026-08-11T07:30:00.000Z", expires_at: "2026-08-11T09:30:00.000Z",
  integrated_source_seal_sha256: control.source_seal.package_sha256, readonly_evidence_sha256: control.readonly_evidence.sha256,
  sanitized_price_evidence_sha256: control.sanitized_price_evidence.sha256,
  api_route_evidence_sha256: control.api_route_evidence.sha256,
  canonical_sha256: control.canonical_sha256, provider_authority: control.provider_authority, pricing: control.pricing,
  normal_chat_binding: { ...control.normal_chat_binding, unchanged_required: true }, configuration_names: control.configuration_names,
  technical_scope: { operator: "TECHNICAL_80_ONLY", logical_total: 80, en: 40, zh_hant: 40, founder_total: 0 },
};
const manifestText = JSON.stringify(manifestBase);
assert.throws(() => validateMicrosoftAuthorization(manifestBase, manifestText, control, NOW), (error) => error.code === WAITING);
const authorizedControl = control;
const authorization = Object.freeze({ sha256: sha256(manifestText), value: Object.freeze(manifestBase) });
for (const [changed, code] of [
  [{ issuer: "Fabricated Microsoft" }, STOP.authorization],
  [{ project_ref: "wrongprojectref00000" }, STOP.authorization],
  [{ function_name: "chat-message" }, STOP.authorization],
  [{ integrated_source_seal_sha256: "c".repeat(64) }, STOP.fabricated],
  [{ readonly_evidence_sha256: "c".repeat(64) }, STOP.fabricated],
  [{ sanitized_price_evidence_sha256: "c".repeat(64) }, STOP.fabricated],
  [{ api_route_evidence_sha256: "c".repeat(64) }, STOP.fabricated],
  [{ canonical_sha256: { ...control.canonical_sha256, adapter: "c".repeat(64) } }, STOP.fabricated],
  [{ provider_authority: { ...control.provider_authority, deployment_alias: "wrong-alias" } }, STOP.providerAuthority],
  [{ provider_authority: { ...control.provider_authority, foundry_service_hostname: "example.com" } }, STOP.providerAuthority],
  [{ pricing: { ...control.pricing, input_price_usd_per_1m_tokens: 1 } }, STOP.pricing],
  [{ pricing: { ...control.pricing, azure_api_version: "unverified" } }, STOP.pricing],
  [{ normal_chat_binding: { ...manifestBase.normal_chat_binding, tree: "c".repeat(40) } }, STOP.normalChat],
  [{ technical_scope: { ...manifestBase.technical_scope, logical_total: 81 } }, STOP.authorization],
  [{ technical_scope: { ...manifestBase.technical_scope, founder_total: 1 } }, STOP.founder],
]) {
  const hostile = { ...manifestBase, ...changed };
  assert.throws(() => validateMicrosoftAuthorization(hostile, JSON.stringify(hostile), authorizedControl, NOW), (error) => error.code === code, code);
}

const probes = Object.fromEntries(control.disabled_probe_names.map((name) => [name, "DICE_AI_DISABLED"]));
const postDeploy = {
  schema: "lumis_dice_default_off_post_deploy_receipt_v1", project_ref: "bmqhwofmdgebpcihjlnb", function_name: "dice-synthetic",
  single_use_deployment_id: manifestBase.single_use_deployment_id, microsoft_manifest_sha256: authorization.sha256,
  integrated_source_seal_sha256: control.source_seal.package_sha256, function_version: 7,
  configuration_names_present: control.configuration_names, disabled_before: true, disabled_during: true, disabled_after: true,
  disabled_probes: probes, provider_calls: 0, normal_chat_binding: control.normal_chat_binding, normal_chat_unchanged: true,
  deployed_at: "2026-08-11T07:45:00.000Z",
};
validatePostDeployReceipt(postDeploy, authorization, authorizedControl, NOW);
for (const hostile of [
  { ...postDeploy, provider_calls: 1 },
  { ...postDeploy, disabled_probes: { ...probes, allow_listed_fixture: "OK" } },
  { ...postDeploy, normal_chat_unchanged: false },
  { ...postDeploy, integrated_source_seal_sha256: "c".repeat(64) },
]) assert.throws(() => validatePostDeployReceipt(hostile, authorization, authorizedControl, NOW), OperatorStop);

class AtomicAuthorityStore {
  rows = new Map();
  async consume(input) {
    if (this.rows.has(input.run_id)) return { kind: "replayed" };
    this.rows.set(input.run_id, input);
    return { kind: "consumed", run_id: input.run_id, consumed_at: new Date(NOW).toISOString(), retain_until: new Date(NOW + 30 * 86_400_000).toISOString() };
  }
}

async function realGatewayExecution(store = new AtomicAuthorityStore(), runId = "dice-tech80-integrated000001") {
  const adapter = { async invoke(input) { return { kind: "success", content: input.language === "en" ? EN_OUTPUT : ZH_OUTPUT }; } };
  const gateway = new DiceSyntheticGatewayPortV1(adapter, store, SECRET, {
    gatewayPackageSha256: control.source_seal.package_sha256,
    fixtureRegistrySha256: control.canonical_sha256.registry,
  }, { now: () => NOW });
  const gateway_authorization = await signDiceDeploymentAuthorization({
    schema: "lumis_dice_default_off_deployment_authorization_v2", interface_version: "dice_synthetic_gateway_port_v1",
    authorization_scope: "technical_80_only", single_use_run_id: runId,
    issued_at: new Date(NOW - 1000).toISOString(), valid_until: new Date(NOW + 60_000).toISOString(),
    gateway_package_sha256: control.source_seal.package_sha256, fixture_registry_sha256: control.canonical_sha256.registry,
    technical_case_count: 80, founder_execution: false,
  }, SECRET);
  return { gateway, gateway_authorization };
}

const claimRoot = mkdtempSync(join(tmpdir(), "s2-t262-claim-"));
const claimAuthority = (name) => createFileDeploymentClaimAuthority({ ledgerPath: join(claimRoot, `${name}.json`) });
const used = claimAuthority("real-success");
const realResult = await runTechnical80({
  control: authorizedControl, authorization, postDeployReceipt: postDeploy, registry,
  claimDeployment: used, createGatewayExecution: () => realGatewayExecution(), now: NOW,
});
assert.equal(realResult.logical_total, 80);
assert.equal(realResult.en, 40);
assert.equal(realResult.zh_hant, 40);
assert.equal(realResult.founder_total, 0);
assert(realResult.attempt_total <= 160);
assert.equal(realResult.provider_disabled_verified, true);

let replayConstructed = 0;
await assert.rejects(() => runTechnical80({
  control: authorizedControl, authorization, postDeployReceipt: postDeploy, registry, claimDeployment: used,
  createGatewayExecution: async () => { replayConstructed += 1; return realGatewayExecution(); }, now: NOW,
}), (error) => error.code === STOP.replay);
assert.equal(replayConstructed, 0);

function evidence(overrides = {}) {
  const records = registry.fixtures.map((fixture) => ({
    schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: "dice-tech80-hostile0000001", fixture_id: fixture.fixture_id,
    phase: "technical", language: fixture.language, result_class: "completed", attempt_count: 1,
    input_tokens: 800, output_tokens: 300, duration_ms: 12000, concurrency_peak: 2, redacted_failure_code: "none",
    observed_at: "2026-08-11T08:00:00.000Z", retain_until: "2026-09-10T08:00:00.000Z",
    effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 },
  }));
  return { schema: "lumis_dice_synthetic_metadata_evidence_package_v1", run_id: "dice-tech80-hostile0000001", technical_case_count: 80, founder_case_count: 0, attempt_total: 80, tokenizer_vocabulary: "o200k_base", provider_disabled_verified: true, records, ...overrides };
}

function fakeExecution(evidencePackage, finalStatus = true) {
  let executed = false;
  return {
    gateway: {
      describe: () => ({ interface_version: "dice_synthetic_gateway_port_v1", registry_version: "lumis_dice_synthetic_registry_v1", prompt_version: "lumis_dice_synthetic_prompt_v1", response_schema: "lumis_dice_synthetic_result_v1", gateway_package_sha256: control.source_seal.package_sha256, fixture_registry_sha256: control.canonical_sha256.registry, technical_case_count: 80, founder_case_count: 0, normal_routes: 0, units_charged: 0, persistence_writes: 0 }),
      status: () => ({ interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: executed && !finalStatus, provider_access: executed && !finalStatus, route_default_off: true, active_run_id: executed && !finalStatus ? "dice-tech80-hostile0000001" : null }),
      executeAuthorizedWindow: async () => { executed = true; return evidencePackage; },
    },
    gateway_authorization: {},
  };
}

const hostileEvidence = [
  [evidence({ records: [...evidence().records, evidence().records[0]] }), STOP.cap, "81 cases"],
  [evidence({ records: evidence().records.map((item) => ({ ...item, attempt_count: 2, result_class: "fallback", redacted_failure_code: "provider_timeout" })), attempt_total: 160 }), null, "160 attempts", 160],
  [evidence({ attempt_total: 161 }), STOP.cap, "161 attempts"],
  [evidence({ records: evidence().records.map((item, index) => index ? item : { ...item, input_tokens: 801 }) }), STOP.cap, "801 input tokens"],
  [evidence({ records: evidence().records.map((item, index) => index ? item : { ...item, output_tokens: 301 }) }), STOP.cap, "301 accepted output tokens"],
  [evidence({ records: evidence().records.map((item, index) => index ? item : { ...item, attempt_count: 2, result_class: "fallback", redacted_failure_code: "provider_timeout" }), attempt_total: 81 }), null, "timeout retry within 160", 81],
];
for (const [index, [value, code, label, expectedAttempts]] of hostileEvidence.entries()) {
  const invocation = runTechnical80({ control: authorizedControl, authorization, postDeployReceipt: postDeploy, registry, claimDeployment: claimAuthority(`evidence-${index}`), createGatewayExecution: async () => fakeExecution(value), now: NOW });
  if (code) await assert.rejects(invocation, (error) => error.code === code, label);
  else assert.equal((await invocation).attempt_total, expectedAttempts, label);
}
await assert.rejects(() => runTechnical80({ control: authorizedControl, authorization, postDeployReceipt: postDeploy, registry, claimDeployment: claimAuthority("disable-failure"), createGatewayExecution: async () => fakeExecution(evidence(), false), now: NOW }), (error) => error.code === STOP.disable);

function runClaimWorker(ledger, deploymentId) {
  return new Promise((resolveWorker) => {
    const child = spawn(process.execPath, ["scripts/s2-t259-dice-authorization-operator-contract.mjs", "--claim-worker", ledger, deploymentId], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolveWorker({ status, stdout, stderr }));
  });
}
const concurrentLedger = join(claimRoot, "cross-process.json");
const concurrentId = "dice-deploy-20260811concurrent";
const concurrent = await Promise.all([runClaimWorker(concurrentLedger, concurrentId), runClaimWorker(concurrentLedger, concurrentId)]);
assert.equal(concurrent.filter((item) => item.status === 0).length, 1);
const replay = spawnSync(process.execPath, ["scripts/s2-t259-dice-authorization-operator-contract.mjs", "--claim-worker", concurrentLedger, concurrentId], { encoding: "utf8" });
assert.equal(replay.status, 2);
assert.match(replay.stderr, new RegExp(STOP.replay));
const lockedLedger = join(claimRoot, "locked.json");
closeSync(openSync(`${lockedLedger}.lock`, "wx", 0o600));
const locked = spawnSync(process.execPath, ["scripts/s2-t259-dice-authorization-operator-contract.mjs", "--claim-worker", lockedLedger, "dice-deploy-20260811lockedcase"], { encoding: "utf8" });
assert.equal(locked.status, 2);
assert.match(locked.stderr, new RegExp(STOP.claimUnavailable));

for (const path of ["supabase/tests/lumis-dice-microsoft-deployment-manifest-v1.schema.json", "supabase/tests/lumis-dice-sanitized-price-evidence-v1.schema.json", "supabase/tests/lumis-dice-api-route-family-evidence-v1.schema.json", "supabase/tests/s2-t259-dice-post-deploy-receipt.schema.json"]) assert.equal(JSON.parse(readFileSync(path, "utf8")).additionalProperties, false);
const boundarySource = readFileSync("supabase/functions/_shared/dice-synthetic-gateway-port-v1.fixtures.ts", "utf8");
for (const proof of ["maximum + 1", "outputedge", "outputcap", "retrycap", "crossinstance", "hostile provider authority rejected", "DICE_AZURE_TRAFFIC_AUTHORITY_MISSING", "2025-04-01-preview"]) assert(boundarySource.includes(proof), proof);
const sources = ["scripts/lib/s2-t259-dice-authorization-operator.mjs", "scripts/lib/s2-t259-durable-deployment-claim.mjs", "scripts/s2-t259-dice-authorization-operator.mjs"].map((path) => readFileSync(path, "utf8")).join("\n");
for (const prohibited of ["fetch(", "createClient(", "functions deploy", "prompt_text", "response_text"]) assert.equal(sources.includes(prohibited), false, prohibited);
rmSync(claimRoot, { recursive: true, force: true });
console.log("S2_T262_DICE_INTEGRATED_OPERATOR_CONTRACT_OK");
