#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  AUTHORIZATION_WINDOW_SECONDS,
  CLOCK_POLICY,
  DeploymentStop,
  STOP,
  claimAuthorization,
  createAuthorizationRequest,
  nextGate,
  sha256,
  validateAuthorizationReceipt,
  validateControl,
  validatePackageSeal,
  validatePostDeployReceipt,
  validateRollbackReceipt,
  verifyAuthorizationPackage,
  verifyPinnedSources,
} from "./lib/s2-t287-dice-v4-deployment-authorization.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const control = validateControl(json("config/s2-t287-dice-v4-deployment-control.json"));
const seal = validatePackageSeal(json("config/s2-t287-dice-v4-deployment-package-seal.json"));
await verifyPinnedSources(control);
await verifyAuthorizationPackage(seal);

assert.equal(control.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(seal.runtime_package_sha256, control.runtime_package_sha256);
assert.equal(control.authorization.schema, "lumis_dice_default_off_function_deployment_authorization_v4");
assert.equal(control.authorization.request_schema, "lumis_dice_default_off_function_deployment_authorization_request_v4");
assert.equal(control.authorization.window_seconds, AUTHORIZATION_WINDOW_SECONDS);
assert.equal(control.authorization.clock_policy, CLOCK_POLICY);
assert.equal(control.configuration_names.length, 15);
assert.equal(control.migration_boundary.application_authorized, false);

const identity = { source_commit: "a".repeat(40), source_tree: "b".repeat(40), clean: true };
const issuerKeyId = "founder-ed25519-primary-2026";
assert.throws(
  () => createAuthorizationRequest(control, seal, { ...identity, clean: false }, "dice-auth-request-abcdefghijklmnop", "c".repeat(64), issuerKeyId),
  (error) => error instanceof DeploymentStop && error.code === STOP.dirty,
);

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const signingKeySha256 = sha256(publicKey.export({ type: "spki", format: "der" }));
const request = createAuthorizationRequest(control, seal, identity, "dice-auth-request-abcdefghijklmnop", signingKeySha256, issuerKeyId);
assert.equal(request.authorization_package_sha256, seal.authorization_package_sha256);
assert.equal(Object.hasOwn(request, "issued_at"), false);
assert.equal(Object.hasOwn(request, "valid_until"), false);
assert.equal(request.request_sha256, sha256(`${JSON.stringify({ ...request, request_sha256: undefined }, (_key, value) => value === undefined ? undefined : value)}\n`));

const issuedAt = "2026-08-11T12:00:00.000Z";
const unsigned = {
  schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  issuer: "Lumis Founder Deployment Approver",
  decision: "AUTHORIZED",
  authorization_scope: control.authorization_scope,
  request_id: request.request_id,
  request_sha256: request.request_sha256,
  project_ref: control.project_ref,
  function_name: control.function_name,
  single_use_deployment_id: "dice-deploy-abcdefghijklmnop",
  issued_at: issuedAt,
  authorization_window_seconds: 900,
  clock_policy: CLOCK_POLICY,
  source_commit: identity.source_commit,
  source_tree: identity.source_tree,
  runtime_package_sha256: control.runtime_package_sha256,
  authorization_package_sha256: seal.authorization_package_sha256,
  bindings: request.bindings,
  issuer_public_key_spki_sha256: signingKeySha256,
  issuer_key_id: issuerKeyId,
  trust_anchor_owner: "Founder",
  configuration_names: control.configuration_names,
  kill_switch_required: false,
  traffic_switch_required: false,
  provider_calls_authorized: 0,
  model_invocations_authorized: 0,
  disabled_probes: control.disabled_probes,
  migration_application_authorized: false,
  migration_required_authorization_scope: "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY",
  normal_chat_binding: control.normal_chat_binding,
  rollback_target: control.rollback.target,
  rollback_revision: "version-41",
  signature_algorithm: "Ed25519",
};
const signed = (value) => ({ ...value, issuer_signature_base64: sign(null, Buffer.from(`${JSON.stringify(value)}\n`), privateKey).toString("base64") });
const receipt = signed(unsigned);
const issuedMs = Date.parse(issuedAt);
const authorization = validateAuthorizationReceipt(receipt, control, seal, request, identity, publicPem, issuedMs + 899_999);
assert.throws(() => validateAuthorizationReceipt(receipt, control, seal, request, identity, publicPem, issuedMs + 900_000), (error) => error.code === STOP.authorizationExpired);
assert.throws(() => validateAuthorizationReceipt(receipt, control, seal, request, identity, publicPem, issuedMs - 300_001), (error) => error.code === STOP.authorizationClock);
assert.throws(() => validateAuthorizationReceipt(signed({ ...unsigned, schema: "lumis_dice_default_off_function_deployment_authorization_v3" }), control, seal, request, identity, publicPem, issuedMs), (error) => error.code === STOP.authorizationShape);
assert.throws(() => validateAuthorizationReceipt(signed({ ...unsigned, source_tree: "d".repeat(40) }), control, seal, request, identity, publicPem, issuedMs), (error) => error.code === STOP.package);
assert.throws(() => validateAuthorizationReceipt(signed({ ...unsigned, migration_application_authorized: true }), control, seal, request, identity, publicPem, issuedMs), (error) => error.code === STOP.authorizationShape);

const temporary = mkdtempSync(join(tmpdir(), "s2-t287-contract-"));
try {
  const claimLedger = join(temporary, "claim");
  await claimAuthorization(authorization, claimLedger);
  await assert.rejects(() => claimAuthorization(authorization, claimLedger), (error) => error.code === STOP.replay);
  const probes = Object.fromEntries(control.disabled_probes.map((name) => [name, "DICE_AI_DISABLED"]));
  const post = {
    schema: "s2_t287_dice_default_off_deployment_receipt_v1",
    project_ref: control.project_ref,
    function_name: control.function_name,
    deployment_id: authorization.deploymentId,
    authorization_sha256: authorization.authorizationSha256,
    request_sha256: authorization.requestSha256,
    signing_key_sha256: authorization.signingKeySha256,
    source_commit: identity.source_commit,
    source_tree: identity.source_tree,
    runtime_package_sha256: control.runtime_package_sha256,
    authorization_package_sha256: seal.authorization_package_sha256,
    configuration_names_verified: true,
    kill_switch_disabled: true,
    traffic_switch_disabled: true,
    function_version: 42,
    rollback_revision: "version-41",
    disabled_probes: probes,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    migration_applied: false,
    rollback_target: control.rollback.target,
    deployed_at: "2026-08-11T12:10:00.000Z",
    credentials_unset: true,
  };
  assert.equal(validatePostDeployReceipt(post, authorization, control, seal), post);
  assert.throws(() => validatePostDeployReceipt({ ...post, authorization_package_sha256: "0".repeat(64) }, authorization, control, seal), (error) => error.code === STOP.receipt);
  assert.throws(() => validatePostDeployReceipt({ ...post, provider_calls: 1 }, authorization, control, seal), (error) => error.code === STOP.receipt);
  const rollback = {
    schema: "s2_t287_dice_rollback_receipt_v1",
    project_ref: control.project_ref,
    function_name: control.function_name,
    deployment_id: authorization.deploymentId,
    source_commit: identity.source_commit,
    function_disabled: true,
    function_removed_or_previous_restored: true,
    restored_revision: "version-41",
    migration_0039_unchanged: true,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    credentials_unset: true,
  };
  assert.equal(validateRollbackReceipt(rollback, authorization, control), rollback);

  const shell = spawnSync("zsh", ["scripts/run-s2-t287-dice-deployment.zsh", "--execute"], { encoding: "utf8" });
  assert.equal(shell.status, 1);
  assert.match(shell.stderr, /STOP_S2_T287_AUTHORIZATION_REQUIRED/u);
  assert.doesNotMatch(shell.stdout + shell.stderr, /Bearer|SUPABASE_ACCESS_TOKEN|services\.ai\.azure/u);

  const probePath = join(temporary, "probe.json");
  writeFileSync(probePath, '{"error":{"code":"DICE_AI_DISABLED"}}\n');
  const probe = spawnSync(process.execPath, ["scripts/s2-t287-remote-deploy-proof.mjs", "probe", "--status=503", `--input=${probePath}`], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

assert.equal(nextGate(), "OBTAIN_LUMIS_FOUNDER_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");
const inert = spawnSync(process.execPath, ["scripts/s2-t287-dice-v4-deployment-authorization.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.equal(JSON.parse(inert.stdout).next_action, "OBTAIN_LUMIS_FOUNDER_V4_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");

const shellSource = readFileSync("scripts/run-s2-t287-dice-deployment.zsh", "utf8");
const claimIndex = shellSource.indexOf("--consume-claim >/dev/null");
const remoteGateIndex = shellSource.indexOf("LUMIS_T287_RUN_REMOTE_DEPLOYMENT");
const credentialIndex = shellSource.indexOf("SUPABASE_ACCESS_TOKEN");
const deployIndex = shellSource.indexOf('supabase functions deploy "$FUNCTION_NAME"');
assert.ok(claimIndex >= 0 && remoteGateIndex > claimIndex && credentialIndex > remoteGateIndex && deployIndex > credentialIndex, "STOP_S2_T287_SOURCE_ORDER_INVALID");
assert.doesNotMatch(shellSource.slice(0, claimIndex), /supabase functions deploy|supabase secrets list|curl |SUPABASE_ACCESS_TOKEN/u);
assert.doesNotMatch(shellSource, /supabase db|migration up|migration repair|AZURE.*KEY/u);

for (const path of [
  "supabase/tests/s2-t287-default-off-deployment-authorization-request-v4.schema.json",
  "supabase/tests/s2-t287-founder-default-off-deployment-authorization-v4.schema.json",
  "supabase/tests/s2-t287-dice-deployment-receipt.schema.json",
  "supabase/tests/s2-t287-dice-rollback-receipt.schema.json",
]) assert.equal(json(path).additionalProperties, false, `${path}:closed`);

const t287Text = [
  "config/s2-t287-dice-v4-deployment-control.json",
  "scripts/lib/s2-t287-dice-v4-deployment-authorization.mjs",
  "scripts/s2-t287-dice-v4-deployment-authorization.mjs",
  "scripts/run-s2-t287-dice-deployment.zsh",
  "scripts/s2-t287-remote-deploy-proof.mjs",
  "supabase/tests/s2-t287-default-off-deployment-authorization-request-v4.schema.json",
  "supabase/tests/s2-t287-founder-default-off-deployment-authorization-v4.schema.json",
].map((path) => readFileSync(path, "utf8")).join("\n");
assert.doesNotMatch(t287Text, /authorization_v3|request_v3|f47b7a82[0-9a-f]{56}|3ccc7551fd945b4ca4c3aaeaa7b8f9efd61f29b56e8ebe3c69ea9f5c5aaae8ba|adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71|S2-T254/u);

console.log("S2_T287_CANONICAL_V4_DEPLOYMENT_OK remote_calls=0 provider_calls=0 model_invocations=0 deployment_calls=0 migration_authorized=false");
