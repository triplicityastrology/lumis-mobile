import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  DeploymentStop,
  STOP,
  claimAuthorization,
  createAuthorizationRequest,
  nextGate,
  sha256,
  validateAuthorizationReceipt,
  validateAuthorizationRequest,
  validateControl,
  validatePostDeployReceipt,
  validateRollbackReceipt,
  verifyPinnedSources,
} from "./lib/s2-t277-dice-deployment-authorization.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const expectStop = (code, operation) => assert.throws(operation, (error) => error instanceof DeploymentStop && error.code === code, code);
const expectReject = async (code, operation) => assert.rejects(operation, (error) => error instanceof DeploymentStop && error.code === code, code);

const control = validateControl(json("config/s2-t277-dice-deployment-authorization.json"));
await verifyPinnedSources(control);
assert.equal(control.source_commit, "f5f9e9da238633d84eb8695307c573eef8f1bc96");
assert.equal(control.source_tree, "666558397b6247ffa54b25ff8ac3f5c64ff5989e");
assert.equal(control.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(control.migration_boundary.application_authorized, false);
assert.equal(control.migration_boundary.required_authorization_scope, "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY");
assert.equal(control.runtime_proof.edge_eszip_sha256, "d01c6b74614fd862b8029b4cb986de3fc08b8ced8644af0389699e61be1cb2fc");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const keySha256 = sha256(publicKey.export({ type: "spki", format: "der" }));
const issuedAt = "2026-08-11T04:00:00.000Z";
const validUntil = "2026-08-11T04:15:00.000Z";
const now = Date.parse("2026-08-11T04:05:00.000Z");
const request = createAuthorizationRequest(control, "dice-auth-request-abcdefghijklmnop", issuedAt, validUntil, keySha256);
validateAuthorizationRequest(request, control);

const unsigned = {
  schema: control.authorization.schema,
  issuer: "Microsoft",
  decision: "AUTHORIZED",
  authorization_scope: control.authorization_scope,
  request_id: request.request_id,
  request_sha256: request.request_sha256,
  project_ref: control.project_ref,
  function_name: control.function_name,
  single_use_deployment_id: "dice-deploy-abcdefghijklmnop",
  issued_at: issuedAt,
  valid_until: validUntil,
  source_commit: control.source_commit,
  source_tree: control.source_tree,
  runtime_package_sha256: control.runtime_package_sha256,
  bindings: request.bindings,
  microsoft_signing_key_sha256: keySha256,
  configuration_names: control.configuration_names,
  kill_switch_required: false,
  traffic_switch_required: false,
  provider_calls_authorized: 0,
  model_invocations_authorized: 0,
  disabled_probes: control.disabled_probes,
  migration_application_authorized: false,
  migration_required_authorization_scope: control.migration_boundary.required_authorization_scope,
  normal_chat_binding: control.normal_chat_binding,
  rollback_target: control.rollback.target,
  rollback_revision: "version-41",
  signature_algorithm: "Ed25519",
};
const receipt = { ...unsigned, microsoft_signature_base64: sign(null, Buffer.from(`${JSON.stringify(unsigned)}\n`), privateKey).toString("base64") };
const authorization = validateAuthorizationReceipt(receipt, control, request, publicPem, now);

expectStop(STOP.project, () => validateAuthorizationReceipt({ ...receipt, project_ref: "wrong" }, control, request, publicPem, now));
expectStop(STOP.function, () => validateAuthorizationReceipt({ ...receipt, function_name: "other" }, control, request, publicPem, now));
expectStop(STOP.package, () => validateAuthorizationReceipt({ ...receipt, runtime_package_sha256: "0".repeat(64) }, control, request, publicPem, now));
expectStop(STOP.package, () => validateAuthorizationReceipt({ ...receipt, bindings: { ...receipt.bindings, handler: "0".repeat(64) } }, control, request, publicPem, now));
expectStop(STOP.authorizationShape, () => validateAuthorizationReceipt({ ...receipt, migration_application_authorized: true }, control, request, publicPem, now));
expectStop(STOP.authorizationShape, () => validateAuthorizationReceipt({ ...receipt, provider_calls_authorized: 1 }, control, request, publicPem, now));
expectStop(STOP.authorizationShape, () => validateAuthorizationReceipt({ ...receipt, model_invocations_authorized: 1 }, control, request, publicPem, now));
expectStop(STOP.authorizationShape, () => validateAuthorizationReceipt({ ...receipt, extra: true }, control, request, publicPem, now));
expectStop(STOP.authorizationStale, () => validateAuthorizationReceipt({ ...receipt, valid_until: "2026-08-11T03:59:59.000Z" }, control, request, publicPem, now));
expectStop(STOP.signature, () => validateAuthorizationReceipt({ ...receipt, microsoft_signature_base64: Buffer.alloc(64).toString("base64") }, control, request, publicPem, now));
expectStop(STOP.signature, () => validateAuthorizationReceipt(receipt, control, request, generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }), now));
expectStop(STOP.authorizationShape, () => validateAuthorizationRequest({ ...request, request_sha256: "0".repeat(64) }, control));

const temporary = mkdtempSync(".tmp-s2-t277-");
try {
  const ledger = join(temporary, "claim");
  const firstClaim = await claimAuthorization(authorization, ledger);
  assert.equal(firstClaim.status, "CLAIMED");
  await expectReject(STOP.replay, () => claimAuthorization(authorization, ledger));

  const probes = Object.fromEntries(control.disabled_probes.map((name) => [name, "DICE_AI_DISABLED"]));
  const deployed = {
    schema: "s2_t277_dice_default_off_deployment_receipt_v1",
    project_ref: control.project_ref,
    function_name: control.function_name,
    deployment_id: authorization.deploymentId,
    authorization_sha256: authorization.authorizationSha256,
    source_commit: control.source_commit,
    runtime_package_sha256: control.runtime_package_sha256,
    configuration_names_verified: true,
    kill_switch_disabled: true,
    traffic_switch_disabled: true,
    function_version: 42,
    rollback_revision: authorization.rollbackRevision,
    disabled_probes: probes,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    migration_applied: false,
    rollback_target: control.rollback.target,
    deployed_at: "2026-08-11T04:10:00.000Z",
    credentials_unset: true,
  };
  validatePostDeployReceipt(deployed, authorization, control);
  expectStop(STOP.probe, () => validatePostDeployReceipt({ ...deployed, disabled_probes: { ...probes, allow_listed_fixture: "OK" } }, authorization, control));
  expectStop(STOP.receipt, () => validatePostDeployReceipt({ ...deployed, provider_calls: 1 }, authorization, control));
  expectStop(STOP.receipt, () => validatePostDeployReceipt({ ...deployed, model_invocations: 1 }, authorization, control));
  expectStop(STOP.receipt, () => validatePostDeployReceipt({ ...deployed, migration_applied: true }, authorization, control));

  const rollback = {
    schema: "s2_t277_dice_rollback_receipt_v1",
    project_ref: control.project_ref,
    function_name: control.function_name,
    deployment_id: authorization.deploymentId,
    function_disabled: true,
    function_removed_or_previous_restored: true,
    restored_revision: authorization.rollbackRevision,
    migration_0039_unchanged: true,
    provider_calls: 0,
    model_invocations: 0,
    normal_chat_unchanged: true,
    credentials_unset: true,
  };
  validateRollbackReceipt(rollback, authorization, control);
  expectStop(STOP.rollback, () => validateRollbackReceipt({ ...rollback, migration_0039_unchanged: false }, authorization, control));

  const shellIssuedAt = new Date(Date.now() - 1_000).toISOString();
  const shellValidUntil = new Date(Date.now() + 10 * 60_000).toISOString();
  const shellRequest = createAuthorizationRequest(control, "dice-auth-request-shellfixtureabcd", shellIssuedAt, shellValidUntil, keySha256);
  const shellUnsigned = {
    ...unsigned,
    request_id: shellRequest.request_id,
    request_sha256: shellRequest.request_sha256,
    issued_at: shellIssuedAt,
    valid_until: shellValidUntil,
    single_use_deployment_id: "dice-deploy-shellfixtureabcd",
  };
  const shellReceipt = { ...shellUnsigned, microsoft_signature_base64: sign(null, Buffer.from(`${JSON.stringify(shellUnsigned)}\n`), privateKey).toString("base64") };
  const requestPath = join(temporary, "request.json");
  const receiptPath = join(temporary, "authorization.json");
  const publicKeyPath = join(temporary, "microsoft-public.pem");
  writeFileSync(requestPath, `${JSON.stringify(shellRequest)}\n`, { mode: 0o600 });
  writeFileSync(receiptPath, `${JSON.stringify(shellReceipt)}\n`, { mode: 0o600 });
  writeFileSync(publicKeyPath, publicPem, { mode: 0o600 });
  const shellResult = spawnSync("zsh", ["scripts/run-s2-t277-dice-deployment.zsh", "--execute", "--request", requestPath, "--authorization", receiptPath, "--microsoft-public-key", publicKeyPath, "--claim-ledger", join(temporary, "shell-claim"), "--receipt-output", join(temporary, "post.json")], { encoding: "utf8" });
  assert.equal(shellResult.status, 1);
  assert.match(shellResult.stderr, /STOP_S2_T277_REMOTE_EXECUTION_NOT_ENABLED/u);
  assert.doesNotMatch(shellResult.stdout + shellResult.stderr, /secret|token|endpoint|authorization_sha256/u);

  const probePath = join(temporary, "probe.json");
  writeFileSync(probePath, '{"error":{"code":"DICE_AI_DISABLED"}}\n');
  const probe = spawnSync(process.execPath, ["scripts/s2-t277-remote-deploy-proof.mjs", "probe", "--status=503", `--input=${probePath}`], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
} finally { rmSync(temporary, { recursive: true, force: true }); }

assert.equal(nextGate(), "OBTAIN_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION");
assert.equal(nextGate({ authorization: true }), "CONSUME_SINGLE_USE_DEPLOYMENT_CLAIM");
assert.equal(nextGate({ authorization: true, claim: true }), "DEPLOY_DICE_SYNTHETIC_DEFAULT_OFF_ONLY");

const inert = spawnSync(process.execPath, ["scripts/s2-t277-dice-deployment-authorization.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.deepEqual(JSON.parse(inert.stdout), {
  status: "WAITING_FOR_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION",
  authorization_scope: "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY",
  next_action: "OBTAIN_MICROSOFT_DEFAULT_OFF_DEPLOYMENT_AUTHORIZATION",
  project: "exact_staging",
  function_name: "dice-synthetic",
  migration_authorized: false,
  remote_calls: 0,
  provider_calls: 0,
  model_invocations: 0,
  deployment_calls: 0,
});

const shell = readFileSync("scripts/run-s2-t277-dice-deployment.zsh", "utf8");
const inertIndex = shell.indexOf("node scripts/s2-t277-dice-deployment-authorization.mjs\n");
const claimIndex = shell.indexOf("--consume-claim >/dev/null");
const remoteGateIndex = shell.indexOf("LUMIS_T277_RUN_REMOTE_DEPLOYMENT");
const credentialIndex = shell.indexOf("SUPABASE_ACCESS_TOKEN");
const deployIndex = shell.indexOf('supabase functions deploy "$FUNCTION_NAME"');
assert.ok(inertIndex >= 0 && claimIndex > inertIndex && remoteGateIndex > claimIndex && credentialIndex > remoteGateIndex && deployIndex > credentialIndex, "STOP_S2_T277_SOURCE_ORDER_INVALID");
assert.doesNotMatch(shell.slice(0, claimIndex), /supabase functions deploy|supabase secrets list|curl |SUPABASE_ACCESS_TOKEN|SUPABASE_ANON_KEY/u);
assert.doesNotMatch(shell, /supabase db|migration up|migration repair|AZURE.*KEY/u);
const runtimeRecheck = readFileSync("scripts/run-s2-t277-dice-runtime-recheck.zsh", "utf8");
assert.match(runtimeRecheck, /docker run --rm --network none/u);
assert.match(runtimeRecheck, /docker network create --internal/u);
assert.match(runtimeRecheck, /--no-remote/u);
assert.doesNotMatch(runtimeRecheck, /docker pull|pnpm install|npm install|SUPABASE_ACCESS_TOKEN=/u);

for (const path of [
  "supabase/tests/s2-t277-default-off-deployment-authorization-request.schema.json",
  "supabase/tests/s2-t277-microsoft-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t277-dice-deployment-receipt.schema.json",
  "supabase/tests/s2-t277-dice-rollback-receipt.schema.json",
]) assert.equal(json(path).additionalProperties, false, `${path}:closed`);

const seal = json("config/s2-t277-dice-deployment-package-seal.json");
assert.equal(seal.schema, "s2_t277_dice_deployment_package_seal_v1");
assert.equal(seal.base_commit, control.source_commit);
assert.equal(seal.runtime_package_sha256, control.runtime_package_sha256);
for (const [path, expected] of Object.entries(seal.files)) assert.equal(digest(path), expected, `STOP_S2_T277_PACKAGE_DRIFT:${path}`);
const canonical = Object.entries(seal.files).sort(([a], [b]) => a.localeCompare(b)).map(([path, hash]) => `${path}:${hash}`).join("\n");
assert.equal(sha256(`${canonical}\n`), seal.authorization_package_sha256);

console.log("S2_T277_DEFAULT_OFF_DEPLOYMENT_RELEASE_OK remote_calls=0 provider_calls=0 model_invocations=0 deployment_calls=0 migration_authorized=false");
