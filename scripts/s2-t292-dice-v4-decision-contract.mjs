#!/usr/bin/env node
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  DecisionStop,
  NEXT_DECISION,
  STOP,
  createReviewPacket,
  sha256,
  validateDecisionControl,
  validateDecisionSeal,
  verifyReady,
} from "./lib/s2-t292-dice-v4-decision-packet.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const control = validateDecisionControl(json("config/s2-t292-dice-v4-decision-control.json"));
const seal = validateDecisionSeal(json("config/s2-t292-dice-v4-decision-package-seal.json"));
await verifyReady();
assert.equal(control.configuration_names.length, 15);
assert.equal(control.disabled_probes.length, 4);
assert.equal(control.authorization_window_seconds, 900);
assert.equal(control.single_use, true);
assert.equal(control.replay_rejected, true);
assert.equal(control.migration_0039_authorized, false);
assert.equal(control.post_deploy.provider_calls, 0);
assert.equal(control.post_deploy.model_invocations, 0);
assert.equal(seal.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");

const preflight = spawnSync(process.execPath, ["scripts/s2-t292-dice-v4-decision-preflight.mjs"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.equal(preflight.stdout, `${NEXT_DECISION}\n`);
assert.equal(preflight.stderr, "");

const { publicKey } = generateKeyPairSync("ed25519");
const signingKeySha256 = sha256(publicKey.export({ type: "spki", format: "der" }));
const issuerKeyId = "founder-ed25519-primary-2026";
const packet = await createReviewPacket({ requestId: "dice-auth-request-t292reviewpacket", issuerPublicKeySpkiSha256: signingKeySha256, issuerKeyId });
assert.equal(packet.authorization_request.schema, "lumis_dice_default_off_function_deployment_authorization_request_v4");
assert.equal(packet.authorization_request.request_sha256.length, 64);
assert.equal(packet.authorization_request.issuer_public_key_spki_sha256, signingKeySha256);
assert.equal(packet.authorization_request.issuer_key_id, issuerKeyId);
assert.equal(packet.authorization_request.trust_anchor_owner, "Founder");
assert.equal(packet.configuration_names.length, 15);
assert.deepEqual(Object.values(packet.disabled_probe_expectations), Array(4).fill("DICE_AI_DISABLED"));
assert.equal(packet.migration_0039_authorized, false);
assert.equal(packet.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(packet.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");

assert.throws(() => validateDecisionControl({ ...control, configuration_names: control.configuration_names.slice(1) }), (error) => error instanceof DecisionStop && error.code === STOP.control);
assert.throws(() => validateDecisionControl({ ...control, migration_0039_authorized: true }), (error) => error.code === STOP.control);
assert.throws(() => validateDecisionSeal({ ...seal, authorization_package_sha256: "0".repeat(64) }), (error) => error.code === STOP.package);

const temporary = mkdtempSync(join(tmpdir(), "s2-t292-contract-"));
try {
  const driftPath = join(temporary, "control.json");
  writeFileSync(driftPath, `${JSON.stringify({ ...control, remote_calls_in_preflight: 1 })}\n`);
  assert.throws(() => validateDecisionControl(JSON.parse(readFileSync(driftPath, "utf8"))), (error) => error.code === STOP.control);
} finally { rmSync(temporary, { recursive: true, force: true }); }

const executor = readFileSync("scripts/run-s2-t287-dice-deployment.zsh", "utf8");
const claim = executor.indexOf("--consume-claim >/dev/null");
const remote = executor.indexOf("LUMIS_T287_RUN_REMOTE_DEPLOYMENT");
const credentials = executor.indexOf("SUPABASE_ACCESS_TOKEN");
assert.ok(claim >= 0 && remote > claim && credentials > remote);
assert.doesNotMatch(executor.slice(0, claim), /curl |supabase functions deploy|SUPABASE_ACCESS_TOKEN/u);
assert.doesNotMatch(executor, /supabase db|migration up|migration repair/u);

const schema = json("supabase/tests/s2-t292-dice-v4-microsoft-decision-packet.schema.json");
assert.equal(schema.additionalProperties, false);
console.log("S2_T292_DICE_V4_DECISION_PACKET_OK remote_calls=0 deployment_calls=0 provider_calls=0 migration_authorized=false");
