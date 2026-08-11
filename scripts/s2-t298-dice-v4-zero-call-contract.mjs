#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateControl, validateSeal, sha256 } from "./lib/s2-t298-dice-v4-zero-call.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const control = validateControl(await readJson("config/s2-t298-dice-v4-zero-call-control.json"));
const seal = validateSeal(await readJson("config/s2-t298-dice-v4-zero-call-package-seal.json"));
const runtimeEvidence = await readJson("config/evidence/s2-t298-dice-v4-zero-call-runtime-proof.json");

assert.equal(control.authorization_scope, "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY");
assert.equal(control.authorization_schema, "lumis_dice_default_off_function_deployment_authorization_v4");
assert.equal(control.runtime_package_sha256, "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457");
assert.equal(control.authorization_package_sha256, "53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799");
assert.equal(control.configuration_names.length, 15);
assert.deepEqual(control.disabled_probes, ["unknown_fixture", "free_form_body", "normal_mobile_body", "allow_listed_fixture"]);
assert.equal(control.authorization_window_seconds, 900);
assert.equal(control.single_use, true);
assert.equal(runtimeEvidence.runtime_package_sha256, control.runtime_package_sha256);
assert.equal(runtimeEvidence.proof.deno_check, "passed");
assert.equal(runtimeEvidence.proof.edge_eszip_bundle, "passed");
assert.equal(runtimeEvidence.proof.import_graph_module_count, 14);
assert.equal(runtimeEvidence.proof.disabled_probe_count, 4);
assert.equal(runtimeEvidence.proof.provider_calls, 0);
assert.equal(runtimeEvidence.proof.model_invocations, 0);
assert.equal(runtimeEvidence.proof.remote_calls, 0);
assert.deepEqual(control.post_deploy, {
  schema: "s2_t298_dice_v4_zero_call_post_deploy_receipt_v1",
  kill_switch_value: false,
  traffic_switch_value: false,
  provider_calls: 0,
  model_invocations: 0,
  migration_0039_applied: false,
  normal_chat_unchanged: true,
  credentials_unset: true,
});

for (const [path, expected] of Object.entries(control.protected_dice_product_sources)) {
  assert.equal(sha256(await readFile(path)), expected, `${path} signed-off bytes changed`);
}

const operator = await readFile("scripts/run-s2-t298-dice-v4-zero-call-deployment.zsh", "utf8");
const validation = operator.indexOf("validateExecutionAuthorization");
const remoteFlag = operator.indexOf("LUMIS_T298_RUN_REMOTE_DEPLOYMENT");
const delegatedExecutor = operator.indexOf("run-s2-t287-dice-deployment.zsh");
assert.ok(validation > 0 && remoteFlag > validation && delegatedExecutor > remoteFlag, "remote boundary must follow authorization validation");
assert.match(operator, /unset LUMIS_T298_RUN_REMOTE_DEPLOYMENT LUMIS_T287_RUN_REMOTE_DEPLOYMENT SUPABASE_ACCESS_TOKEN SUPABASE_ANON_KEY/u);
assert.doesNotMatch(operator.slice(0, validation), /supabase|curl|SUPABASE_ACCESS_TOKEN/u);

const postSchema = await readFile("supabase/tests/s2-t298-dice-v4-zero-call-post-deploy-receipt.schema.json", "utf8");
for (const required of [
  '"kill_switch_value": { "const": false }',
  '"traffic_switch_value": { "const": false }',
  '"provider_calls": { "const": 0 }',
  '"model_invocations": { "const": 0 }',
  '"normal_chat_unchanged": { "const": true }',
  '"migration_0039_applied": { "const": false }',
  '"credentials_unset": { "const": true }',
]) assert.match(postSchema, new RegExp(required.replace(/[{}]/gu, "\\$&"), "u"));

const hostile = structuredClone(control);
hostile.post_deploy.kill_switch_value = true;
assert.throws(() => validateControl(hostile), /STOP_S2_T298_CONTROL_INVALID/u);
const hostileProduct = structuredClone(control);
hostileProduct.protected_dice_product_sources["apps/mobile/src/features/dice/DiceRitualScreen.tsx"] = "0".repeat(64);
assert.notEqual(hostileProduct.protected_dice_product_sources["apps/mobile/src/features/dice/DiceRitualScreen.tsx"], sha256(await readFile("apps/mobile/src/features/dice/DiceRitualScreen.tsx")));

assert.equal(seal.runtime_package_sha256, control.runtime_package_sha256);
assert.equal(execFileSync("zsh", ["-n", "scripts/run-s2-t298-dice-v4-zero-call-deployment.zsh"]).length, 0);
process.stdout.write("S2-T298 zero-call deployment contracts passed; signed product pixels unchanged and remote execution remains separately authorized.\n");
