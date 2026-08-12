#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createAuthorizationRequest } from "./lib/s2-t287-dice-v4-deployment-authorization.mjs";
import {
  NEXT_ACTION,
  STOP,
  T308Stop,
  sha256,
  validateAndClaim,
  validateControl,
  validateDisabledProbeResults,
  validateSeal,
  verifyPackage,
} from "./lib/s2-t308-v4-receipt-deployment-day.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const control = validateControl(json("config/s2-t308-v4-receipt-deployment-day-control.json"));
validateSeal(json("config/s2-t308-v4-receipt-deployment-day-package-seal.json"));
const ready = await verifyPackage(process.cwd(), { requireClean: false });

assert.equal(control.authorization.window_seconds, 900);
assert.equal(control.authorization.signature_algorithm, "Ed25519");
assert.equal(control.required_receipt_values.migration_application_authorized, false);
assert.equal(control.required_receipt_values.traffic_switch_required, false);
assert.equal(control.automatic_rollback.required, true);
assert.equal(control.pre_receipt_boundary.credential_reads, 0);
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const issuerPublicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const signingKeySha256 = sha256(publicKey.export({ type: "spki", format: "der" }));
const issuerKeyId = "founder-ed25519-primary-2026";
const t287Control = ready.upstream.upstream.t287Control;
const t287Seal = ready.upstream.upstream.t287Seal;
const testIdentity = { ...ready.identity, clean: true };
const request = createAuthorizationRequest(t287Control, t287Seal, testIdentity, "dice-auth-request-t308abcdefghijkl", signingKeySha256, issuerKeyId);
const issuedAt = "2026-08-12T04:00:00.000Z";
const unsigned = {
  schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  issuer: "Lumis Founder Deployment Approver",
  decision: "AUTHORIZED",
  authorization_scope: control.authorization_scope,
  request_id: request.request_id,
  request_sha256: request.request_sha256,
  project_ref: control.project_ref,
  function_name: control.function_name,
  single_use_deployment_id: "dice-deploy-t308abcdefghijkl",
  issued_at: issuedAt,
  authorization_window_seconds: 900,
  clock_policy: "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW",
  source_commit: ready.identity.source_commit,
  source_tree: ready.identity.source_tree,
  runtime_package_sha256: control.source_authority.runtime_package_sha256,
  authorization_package_sha256: control.source_authority.authorization_package_sha256,
  bindings: request.bindings,
  issuer_public_key_spki_sha256: signingKeySha256,
  issuer_key_id: issuerKeyId,
  trust_anchor_owner: "Founder",
  configuration_names: t287Control.configuration_names,
  kill_switch_required: false,
  traffic_switch_required: false,
  provider_calls_authorized: 0,
  model_invocations_authorized: 0,
  disabled_probes: control.disabled_probes,
  migration_application_authorized: false,
  migration_required_authorization_scope: "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY",
  normal_chat_binding: t287Control.normal_chat_binding,
  rollback_target: t287Control.rollback.target,
  rollback_revision: "version-41",
  signature_algorithm: "Ed25519",
};
const signed = (value, key = privateKey) => ({ ...value, issuer_signature_base64: sign(null, Buffer.from(`${JSON.stringify(value)}\n`), key).toString("base64") });
const receipt = signed(unsigned);
const issuedMs = Date.parse(issuedAt);
const temporary = mkdtempSync(join(tmpdir(), "s2-t308-contract-"));

try {
  const ledger = join(temporary, "claim");
  const accepted = await validateAndClaim({ request, receipt, issuerPublicKeyPem, ledgerPath: ledger, now: issuedMs + 899_999, requireClean: false });
  assert.equal(accepted.authorization.deploymentId, unsigned.single_use_deployment_id);
  await assert.rejects(
    () => validateAndClaim({ request, receipt, issuerPublicKeyPem, ledgerPath: ledger, now: issuedMs + 899_999, requireClean: false }),
    (error) => error instanceof T308Stop && error.code === STOP.replay,
  );

  const rejects = async (changed, code, now = issuedMs) => assert.rejects(
    () => validateAndClaim({ request, receipt: changed, issuerPublicKeyPem, ledgerPath: join(temporary, code), now, requireClean: false }),
    (error) => error instanceof T308Stop && error.code === code,
  );
  await rejects(receipt, STOP.stale, issuedMs + 900_000);
  await rejects(signed({ ...unsigned, project_ref: "wrongprojectref00000" }), STOP.project);
  await rejects(signed({ ...unsigned, function_name: "wrong-function" }), STOP.function);
  await rejects(signed({ ...unsigned, runtime_package_sha256: "0".repeat(64) }), STOP.package);
  await rejects(signed({ ...unsigned, kill_switch_required: true }), STOP.switches);
  await rejects(signed({ ...unsigned, traffic_switch_required: true }), STOP.traffic);
  await rejects(signed({ ...unsigned, provider_calls_authorized: 1 }), STOP.traffic);
  await rejects(signed({ ...unsigned, migration_application_authorized: true }), STOP.migration);
  await rejects(signed({ ...unsigned, rollback_revision: "" }), STOP.rollback);
  const otherKey = generateKeyPairSync("ed25519").privateKey;
  await rejects(signed(unsigned, otherKey), STOP.signature);

  assert.deepEqual(validateDisabledProbeResults({ unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED" }), {
    unknown_fixture: "DICE_AI_DISABLED", free_form_body: "DICE_AI_DISABLED", normal_mobile_body: "DICE_AI_DISABLED", allow_listed_fixture: "DICE_AI_DISABLED"
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const operator = readFileSync("scripts/run-s2-t308-v4-deployment-day.zsh", "utf8");
const preflight = operator.indexOf("s2-t308-v4-receipt-intake.mjs");
const missingReceipt = operator.indexOf("STOP_S2_T308_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED");
const claim = operator.indexOf("--ledger=\"$CLAIM_LEDGER\"");
const executionGate = operator.indexOf("LUMIS_T308_RUN_REMOTE_DEPLOYMENT");
const credentials = operator.indexOf("SUPABASE_ACCESS_TOKEN");
const cli = operator.indexOf("pnpm exec supabase");
const deploymentAttempt = operator.indexOf("DEPLOY_ATTEMPTED=1");
const deploy = operator.lastIndexOf('supabase functions deploy "$FUNCTION_NAME"');
assert.ok(preflight >= 0 && missingReceipt > preflight && claim > missingReceipt && executionGate > claim && credentials > executionGate && cli > credentials, "STOP_S2_T308_SOURCE_ORDER_INVALID");
assert.ok(operator.indexOf("rollback_if_needed") >= 0 && operator.indexOf("RESTORE_CAPTURED_PRIOR_SOURCE") === -1 && deploymentAttempt > cli && deploy > deploymentAttempt, "STOP_S2_T308_ROLLBACK_ORDER_INVALID");
assert.match(operator, /functions download.*--use-api/u);
assert.match(operator, /functions delete.*--project-ref/u);
assert.doesNotMatch(operator.slice(0, claim), /pnpm exec supabase|curl |SUPABASE_ACCESS_TOKEN|SUPABASE_ANON_KEY/u);
assert.doesNotMatch(operator, /supabase db|migration up|migration repair|LUMIS_DICE_AI_ENABLED=true|LUMIS_DICE_TRAFFIC_AUTHORIZED=true/u);

const syntax = spawnSync("zsh", ["-n", "scripts/run-s2-t308-v4-deployment-day.zsh"], { encoding: "utf8" });
assert.equal(syntax.status, 0, syntax.stderr);
assert.equal(NEXT_ACTION, "SUPPLY_SIGNED_V4_DEFAULT_OFF_DEPLOYMENT_RECEIPT");

process.stdout.write("S2_T308_V4_RECEIPT_DEPLOYMENT_DAY_OK remote_calls=0 provider_calls=0 model_invocations=0 migration_0039_authorized=false\n");
