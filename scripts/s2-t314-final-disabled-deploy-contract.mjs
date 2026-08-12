#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  ISSUER,
  ISSUER_KEY_ID,
  ISSUER_PUBLIC_KEY_SPKI_SHA256,
  PROBES,
  STOP,
  T314Stop,
  claimReceipt,
  createRequest,
  sha256,
  validateControl,
  validatePostReceipt,
  verifyDetachedEd25519ForTest,
  verifyPinnedFounderPublicKey,
  verifyPackage,
} from "./lib/s2-t314-final-disabled-deploy.mjs";

const expectStop = (code, fn) => assert.throws(fn, (error) => error instanceof T314Stop && error.code === code);
const ready = await verifyPackage(process.cwd(), { requireClean: false });
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const now = Date.parse("2026-08-12T00:00:00.000Z");

expectStop(STOP.request, () => createRequest(ready, {
  requestId: "dice-founder-deploy-request-314contract00010",
  issuerKeyId: "founder-ed25519-wrong-approver-v1",
  publicKeyPem,
}));
expectStop(STOP.signature, () => createRequest(ready, {
  requestId: "dice-founder-deploy-request-314contract00010",
  issuerKeyId: ISSUER_KEY_ID,
  publicKeyPem,
}));
expectStop(STOP.signature, () => verifyPinnedFounderPublicKey(publicKeyPem));
expectStop(STOP.control, () => validateControl({
  ...ready.control,
  issuer: { ...ready.control.issuer, issuer_key_id: "founder-ed25519-wrong-approver-v1" },
}));
expectStop(STOP.control, () => validateControl({
  ...ready.control,
  issuer: { ...ready.control.issuer, issuer_public_key_spki_sha256: "0".repeat(64) },
}));

const detachedPayload = "T314 Ed25519 implementation fixture\n";
const detachedSignature = sign(null, Buffer.from(detachedPayload), privateKey).toString("base64");
const ephemeralFingerprint = sha256(publicKey.export({ type: "spki", format: "der" }));
assert.equal(verifyDetachedEd25519ForTest({ publicKeyPem, expectedFingerprint: ephemeralFingerprint, payload: detachedPayload, signatureBase64: detachedSignature }), true);
assert.equal(verifyDetachedEd25519ForTest({ publicKeyPem, expectedFingerprint: ISSUER_PUBLIC_KEY_SPKI_SHA256, payload: detachedPayload, signatureBase64: detachedSignature }), false);

const accepted = Object.freeze({
  deploymentId: "dice-founder-deploy-314contract00010",
  authorizationSha256: "a".repeat(64),
  requestSha256: "b".repeat(64),
  rollbackRevision: "version-42",
  issuerKeyId: ISSUER_KEY_ID,
  issuerPublicKeySpkiSha256: ISSUER_PUBLIC_KEY_SPKI_SHA256,
});

const temp = await mkdtemp(join(process.cwd(), ".tmp-s2-t314-"));
try {
  const ledger = join(temp, "claim");
  await claimReceipt(accepted, ledger);
  await assert.rejects(() => claimReceipt(accepted, ledger), (error) => error instanceof T314Stop && error.code === STOP.replay);
} finally {
  await rm(temp, { recursive: true, force: true });
}

const post = {
  schema: "s2_t314_zero_call_post_deploy_receipt_v1",
  project_ref: ready.control.project_ref,
  function_name: ready.control.function_name,
  deployment_id: accepted.deploymentId,
  authorization_sha256: accepted.authorizationSha256,
  request_sha256: accepted.requestSha256,
  issuer_key_id: accepted.issuerKeyId,
  issuer_public_key_spki_sha256: accepted.issuerPublicKeySpkiSha256,
  source_commit: ready.identity.source_commit,
  source_tree: ready.identity.source_tree,
  package_sha256: ready.seal.package_sha256,
  runtime_package_sha256: ready.control.source_authority.runtime_package_sha256,
  founder_registry_sha256: ready.registry.registry_payload_sha256,
  kill_switch_disabled: true,
  traffic_switch_disabled: true,
  function_version: 43,
  rollback_revision: accepted.rollbackRevision,
  disabled_probes: Object.fromEntries(PROBES.map((name) => [name, "DICE_AI_DISABLED"])),
  provider_calls: 0,
  model_invocations: 0,
  normal_chat_unchanged: true,
  migration_0039_applied: false,
  rollback_target: ready.control.rollback.target,
  deployed_at: new Date(now).toISOString(),
  credentials_unset: true,
};
assert.equal(validatePostReceipt(post, accepted, ready).provider_calls, 0);
expectStop(STOP.postReceipt, () => validatePostReceipt({ ...post, migration_0039_applied: true }, accepted, ready));
expectStop(STOP.postReceipt, () => validatePostReceipt({ ...post, disabled_probes: { ...post.disabled_probes, allow_listed_fixture: "DICE_COMPLETED" } }, accepted, ready));

assert.equal(ready.registry.fixtures.length, 40);
assert.equal(ready.registry.fixtures.filter((item) => item.language === "en").length, 20);
assert.equal(ready.registry.fixtures.filter((item) => item.language === "zh-Hant").length, 20);
assert(!ready.registry.fixtures.some((item) => item.authoring_id === "ZH04"));
assert(ready.registry.fixtures.some((item) => item.authoring_id === "ZH08"));
assert(ready.registry.fixtures.some((item) => item.authoring_id === "ZH09"));

const adapter = await readFile("apps/mobile/src/services/diceLiveResultAdapter.ts", "utf8");
const operator = await readFile("scripts/run-s2-t314-final-disabled-deploy.zsh", "utf8");
const screen = await readFile("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
assert.match(adapter, /resolveDiceFounderFixture/);
assert.match(adapter, /fixture\.exact_text !== request\.question/);
assert.doesNotMatch(adapter, /\^dice-founder-/);
assert(operator.indexOf("s2-t314-final-disabled-deploy.mjs intake") < operator.indexOf("SUPABASE_ACCESS_TOKEN"));
assert(operator.indexOf("s2-t314-final-disabled-deploy.mjs intake") < operator.indexOf("pnpm exec supabase"));
assert.match(operator, /migration_0039_applied=false/);
const screenSource = screen.toString("utf8");
for (const invariant of ["Roll again", "Reflect in Chat", "DiceInterpretationCard", "buildReflectionPrompt"]) {
  assert(screenSource.includes(invariant), `Dice result-card invariant missing: ${invariant}`);
}

for (const path of [
  "supabase/tests/s2-t314-founder-deployment-request.schema.json",
  "supabase/tests/s2-t314-founder-deployment-authorization.schema.json",
  "supabase/tests/s2-t314-zero-call-post-deploy-receipt.schema.json",
]) JSON.parse(await readFile(path, "utf8"));

console.log("S2-T314 final disabled deployment contracts passed");
