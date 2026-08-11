import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { STOP, TechnicalWindowStop, loadAndValidateControl, runTechnicalWindow, sha256, validateDeploymentReceipt, validateEvidencePackage, validateMigrationReceipt, validateProviderEvidence, validateRegistry, validateTrafficAuthority } from "./lib/s2-t289-dice-technical-window.mjs";

const { control, registry } = loadAndValidateControl();
assert.equal(control.founder_authority.receipt_design, "APPROVED");
assert.equal(control.founder_authority.operational_actions_authorized, false);
assert.equal(control.deployment.schema, "lumis_dice_default_off_function_deployment_authorization_v4");
assert.equal(control.deployment.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(control.migration.proof_receipt_sha256, "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e");
assert.equal(registry.fixtures.filter((item) => item.language === "en").length, 40);
assert.equal(registry.fixtures.filter((item) => item.language === "zh-Hant").length, 40);

const now = Date.now();
const deployment = { schema: "s2_t289_accepted_v4_post_deploy_disabled_receipt_v1", authorization_schema: control.deployment.schema, project_ref: control.project_ref, function_name: control.function_name,
  deployment_id: "dice-deploy-contractproofv4001", source_commit: control.deployment.authority_commit, runtime_package_sha256: control.deployment.runtime_package_sha256,
  disabled_probes: { unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" },
  provider_calls: 0, model_invocations: 0, kill_switch_disabled: true, traffic_switch_disabled: true, migration_applied: false, deployed_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString() };
const migration = { schema: "s2_t289_accepted_t283_migration_0039_receipt_v1", authorization_scope: control.migration.authorization_scope, project_ref: control.project_ref,
  migration_version: "0039", migration_sha256: control.migration.migration_sha256, proof_commit: control.migration.proof_commit, proof_receipt_schema: control.migration.proof_receipt_schema,
  proof_receipt_sha256: control.migration.proof_receipt_sha256, applied: true, parity_verified: true, rpc_rls_verified: true, concurrency_replay_caps_verified: true, cleanup_verified: true,
  provider_calls: 0, issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString() };
const traffic = { schema: "lumis_dice_technical_synthetic_window_80_authorization_v1", issuer: "Microsoft", decision: "AUTHORIZED", authorization_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  single_use_run_id: "dice-tech80-contractproofv4001", deployment_id: deployment.deployment_id, migration_version: "0039", runtime_package_sha256: control.deployment.runtime_package_sha256,
  migration_proof_receipt_sha256: control.migration.proof_receipt_sha256, registry_sha256: control.registry.payload_sha256, technical_cases: 80, language: { en: 40, "zh-Hant": 40 }, founder_cases: 0,
  attempt_cap: 160, concurrency: 2, eligible_retries: 1, shared_deadline_ms: 12000, input_token_cap: 800, output_token_cap: 300, tokenizer: "js-tiktoken@1.0.21/o200k_base",
  cost_ceiling_usd: 0.128, issued_at: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60_000).toISOString(), signature_algorithm: "Ed25519", microsoft_signature_base64: `${"A".repeat(86)}==` };
validateDeploymentReceipt(deployment, control, now); validateMigrationReceipt(migration, control, now); validateTrafficAuthority(traffic, control, deployment, migration, now);

for (const [validator, original, mutations, code, extras = []] of [
  [validateDeploymentReceipt, deployment, [(v) => { v.authorization_schema = "v3"; }, (v) => { v.runtime_package_sha256 = "f".repeat(64); }, (v) => { v.provider_calls = 1; }, (v) => { v.disabled_probes.unknown_fixture = "OK"; }, (v) => { v.extra = true; }], STOP.deployment, [control, now]],
  [validateMigrationReceipt, migration, [(v) => { v.authorization_scope = "FUNCTION_DEPLOYMENT"; }, (v) => { v.proof_receipt_sha256 = "f".repeat(64); }, (v) => { v.applied = false; }, (v) => { v.extra = true; }], STOP.migration, [control, now]],
]) for (const mutate of mutations) { const value = structuredClone(original); mutate(value); assert.throws(() => validator(value, ...extras), (error) => error.code === code); }
for (const mutate of [(v) => { v.technical_cases = 81; }, (v) => { v.language.en = 39; }, (v) => { v.founder_cases = 40; }, (v) => { v.attempt_cap = 161; }, (v) => { v.concurrency = 3; }, (v) => { v.eligible_retries = 2; }, (v) => { v.shared_deadline_ms = 12001; }, (v) => { v.input_token_cap = 801; }, (v) => { v.output_token_cap = 301; }, (v) => { v.cost_ceiling_usd = 0.129; }, (v) => { v.runtime_package_sha256 = "f".repeat(64); }, (v) => { v.extra = true; }]) { const value = structuredClone(traffic); mutate(value); assert.throws(() => validateTrafficAuthority(value, control, deployment, migration, now), (error) => error.code === STOP.traffic); }
assert.throws(() => validateRegistry([...registry.fixtures, { fixture_id: "DICE-FOUNDER-EN-01", language: "en", phase: "founder" }]), (error) => error.code === STOP.registry);

const status = (disabled, runId = null) => ({ interface_version: "dice_synthetic_gateway_status_v1", lumis_ai_enabled: !disabled, provider_access: !disabled, route_default_off: true, active_run_id: disabled ? null : runId });
function gateway({ postBad = false, throwRun = false } = {}) { let disabled = true; return { async status() { return status(disabled, traffic.single_use_run_id); }, async executeAuthorizedWindow() { disabled = false; try { if (throwRun) throw new Error("redacted"); const observed = new Date(now).toISOString(); const records = registry.fixtures.map((fixture) => ({ schema: "lumis_dice_synthetic_metadata_evidence_v1", run_id: traffic.single_use_run_id, fixture_id: fixture.fixture_id, phase: "technical", language: fixture.language, result_class: "completed", attempt_count: 1, input_tokens: 400, output_tokens: 150, duration_ms: 20, concurrency_peak: 2, redacted_failure_code: "none", observed_at: observed, retain_until: new Date(now + 30 * 86_400_000).toISOString(), effects: { normal_routes: 0, units_charged: 0, persistence_writes: 0 } })); return { schema: "lumis_dice_synthetic_metadata_evidence_package_v1", run_id: traffic.single_use_run_id, technical_case_count: 80, founder_case_count: 0, attempt_total: 80, tokenizer_vocabulary: "o200k_base", provider_disabled_verified: true, records }; } finally { if (!postBad) disabled = true; } } }; }
const evidence = await runTechnicalWindow({ gateway: gateway(), deploymentReceipt: deployment, migrationReceipt: migration, trafficAuthority: traffic }); validateEvidencePackage(evidence);
assert.equal(evidence.technical_case_count, 80); assert.equal(evidence.founder_case_count, 0); assert.equal(evidence.attempt_total, 80); assert.equal(evidence.concurrency_peak, 2);
for (const mutate of [(v) => { v.input_tokens = 801; }, (v) => { v.output_tokens = 301; }, (v) => { v.duration_ms = 12001; }, (v) => { v.prompt = "forbidden"; }]) { const value = structuredClone(evidence.records[0]); mutate(value); assert.throws(() => validateProviderEvidence(value, registry.fixtures[0], traffic.single_use_run_id)); }
await assert.rejects(() => runTechnicalWindow({ gateway: gateway(), deploymentReceipt: deployment, migrationReceipt: migration, trafficAuthority: traffic, claimRun: async () => false }), (error) => error.code === STOP.replay);
await assert.rejects(() => runTechnicalWindow({ gateway: gateway({ postBad: true }), deploymentReceipt: deployment, migrationReceipt: migration, trafficAuthority: traffic }), (error) => error.code === STOP.disable);

const defaultRun = spawnSync(process.execPath, ["scripts/s2-t289-dice-technical-window.mjs"], { encoding: "utf8" }); assert.equal(defaultRun.status, 2); assert.equal(JSON.parse(defaultRun.stdout).status, STOP.deployment);
mkdirSync(".tmp/s2-t289-contract", { recursive: true }); writeFileSync(".tmp/s2-t289-contract/deploy.json", `${JSON.stringify(deployment)}\n`);
const missingMigration = spawnSync(process.execPath, ["scripts/s2-t289-dice-technical-window.mjs", "--deployment-receipt", ".tmp/s2-t289-contract/deploy.json"], { encoding: "utf8" }); assert.equal(JSON.parse(missingMigration.stdout).status, STOP.migration);

for (const path of ["supabase/tests/s2-t289-v4-post-deploy-disabled-receipt.schema.json", "supabase/tests/s2-t289-t283-migration-receipt.schema.json", "supabase/tests/s2-t289-technical-traffic-authorization.schema.json", "supabase/tests/s2-t289-technical-evidence-package.schema.json"]) assert.equal(JSON.parse(readFileSync(path, "utf8")).additionalProperties, false);
const active = ["config/s2-t289-dice-v4-technical-window.json", "scripts/lib/s2-t289-dice-technical-window.mjs", "scripts/s2-t289-dice-technical-window.mjs", "scripts/s2-t289-dice-technical-window-emulator.mjs", "supabase/tests/s2-t289-v4-post-deploy-disabled-receipt.schema.json", "supabase/tests/s2-t289-t283-migration-receipt.schema.json", "supabase/tests/s2-t289-technical-traffic-authorization.schema.json"];
const retiredMarkers = ["f47b" + "7a82", "3ccc" + "7551", "authorization_" + "v3", "T" + "254", "t" + "254"];
for (const path of active) assert(retiredMarkers.every((marker) => !readFileSync(path, "utf8").includes(marker)), `stale active alias: ${path}`);
const guide = readFileSync("docs/qa/S2-T289-dice-v4-technical-window.md", "utf8"); assert.match(guide, /NO_AZURE_TRAFFIC_AUTHORITY/); assert.match(guide, /receipt-design authority only/);
const emulator = execFileSync(process.execPath, ["scripts/s2-t289-dice-technical-window-emulator.mjs"], { encoding: "utf8" }); assert.match(emulator, /cases=80 en=40 zh_hant=40/);
const manifest = JSON.parse(readFileSync("config/s2-t289-dice-v4-technical-window-manifest.json", "utf8"));
assert.equal(manifest.runtime_package_sha256, control.deployment.runtime_package_sha256);
assert.equal(manifest.migration_proof_receipt_sha256, control.migration.proof_receipt_sha256);
const packageInput = Object.entries(manifest.files).map(([path, expected]) => { const actual = sha256(readFileSync(path)); assert.equal(actual, expected, `sealed drift: ${path}`); return `${path}:${actual}\n`; }).join("");
assert.equal(sha256(packageInput), manifest.package_sha256);
console.log("S2_T289_DICE_V4_TECHNICAL_WINDOW_CONTRACT_OK cases=80 en=40 zh_hant=40 remote_calls=0");
