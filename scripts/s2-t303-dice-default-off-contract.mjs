#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  STOP,
  T303Stop,
  validateControl,
  validateSeal,
  verifyPackage,
} from "./lib/s2-t303-dice-default-off-final.mjs";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const control = validateControl(json("config/s2-t303-dice-default-off-final-control.json"));
const seal = validateSeal(json("config/s2-t303-dice-default-off-final-package-seal.json"));
await verifyPackage(process.cwd(), { requireClean: false });

assert.equal(control.authorization_scope, "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY");
assert.equal(control.authorization_schema, "lumis_dice_default_off_function_deployment_authorization_v4");
assert.equal(control.clock.policy, "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW");
assert.equal(control.clock.window_seconds, 900);
assert.equal(control.clock.absolute_expiry_embedded, false);
assert.equal(control.single_use.durable_claim_before_remote, true);
assert.equal(control.configuration_names_count, 15);
assert.equal(control.disabled_probes.length, 4);
assert.equal(control.kill_switch_required, false);
assert.equal(control.traffic_switch_required, false);
assert.equal(control.provider_calls_authorized, 0);
assert.equal(control.model_invocations_authorized, 0);
assert.equal(control.migration_0039_authorized, false);
assert.equal(control.rollback_revision_required, true);
assert.equal(control.normal_chat_unchanged_required, true);
assert.deepEqual(control.pre_authorization, { remote_commands: 0, client_construction: 0, credential_reads: 0, receipt_mutations: 0 });
assert.equal(seal.runtime_package_sha256, control.runtime_package_sha256);
assert.equal(seal.authorization_package_sha256, control.authorization_package_sha256);

for (const hostile of [
  { ...control, migration_0039_authorized: true },
  { ...control, provider_calls_authorized: 1 },
  { ...control, traffic_switch_required: true },
  { ...control, rollback_revision_required: false },
  { ...control, clock: { ...control.clock, window_seconds: 901 } },
  { ...control, single_use: { ...control.single_use, replay_rejected: false } },
  { ...control, pre_authorization: { ...control.pre_authorization, credential_reads: 1 } },
]) assert.throws(() => validateControl(hostile), (error) => error instanceof T303Stop && error.code === STOP.control);

assert.throws(() => validateSeal({ ...seal, package_sha256: "0".repeat(64) }), (error) => error.code === STOP.seal);

const operator = readFileSync("scripts/run-s2-t303-dice-default-off-deployment.zsh", "utf8");
const preflight = operator.indexOf("s2-t303-dice-default-off-preflight.mjs");
const argumentsGate = operator.indexOf("STOP_S2_T303_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED");
const validation = operator.indexOf("validateOperationalAuthorization");
const remoteGate = operator.indexOf("LUMIS_T303_RUN_REMOTE_DEPLOYMENT");
const delegate = operator.indexOf("run-s2-t298-dice-v4-zero-call-deployment.zsh");
assert.ok(preflight >= 0 && argumentsGate > preflight && validation > argumentsGate && remoteGate > validation && delegate > remoteGate, "STOP_S2_T303_SOURCE_ORDER_INVALID");
assert.doesNotMatch(operator.slice(0, validation), /supabase functions deploy|curl |SUPABASE_ACCESS_TOKEN|SUPABASE_ANON_KEY/u);
assert.doesNotMatch(operator, /supabase db|migration up|migration repair|LUMIS_AI_ENABLED|AZURE.*KEY/u);

const shellSyntax = spawnSync("zsh", ["-n", "scripts/run-s2-t303-dice-default-off-deployment.zsh"], { encoding: "utf8" });
assert.equal(shellSyntax.status, 0, shellSyntax.stderr);

process.stdout.write("S2_T303_DEFAULT_OFF_FINAL_OK remote_calls=0 provider_calls=0 model_invocations=0 migration_0039_authorized=false\n");
