#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTROL_PATH, SEAL_PATH, T307Stop, packageSha, readJson, verifyRelease } from "./lib/s2-t307-dice-release-candidate.mjs";

const control = readJson(CONTROL_PATH);
const seal = readJson(SEAL_PATH);
const ready = verifyRelease({ requireClean: false });
assert.equal(ready.seal.package_sha256, seal.package_sha256);
assert.equal(packageSha(control, seal.files), seal.package_sha256);
assert.deepEqual(control.required_external_receipts, [
  "accepted_v4_post_deploy_disabled_receipt",
  "accepted_0039_migration_receipt",
  "accepted_DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY_receipt"
]);
assert.deepEqual(control.founder_bank, {
  english: 20,
  zh_hant: 20,
  excluded_authoring_id: "ZH04",
  excluded_exact_text: "我去到澳洲應該讀書定係做嘢？",
  zh08: "bundled_question_rejection",
  zh09: "accepted_single_question_control"
});
assert.equal(control.effects_without_receipts.remote_calls, 0);
assert.equal(control.effects_without_receipts.provider_calls, 0);
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");

const adapter = readFileSync("apps/mobile/src/services/diceLiveResultAdapter.ts", "utf8");
assert.match(adapter, /if \(!config\.ai_enabled \|\| !config\.traffic_authorized\)/);
assert.match(adapter, /create_gateway_transport\?\./);
assert.doesNotMatch(adapter, /AZURE|api[_-]?key|endpoint/iu);
const t303 = readFileSync("scripts/run-s2-t303-dice-default-off-deployment.zsh", "utf8");
assert.match(t303, /STOP_S2_T303_SEPARATE_OPERATIONAL_AUTHORIZATION_REQUIRED/);
const t304 = readFileSync("config/s2-t304-dice-80-results.json", "utf8");
assert.match(t304, /"technical_cases": 80/);
assert.match(t304, /"en": 40/);
assert.match(t304, /"zh_hant": 40/);
assert.match(t304, /"cost_ceiling_usd": 0\.128/);

const hostile = structuredClone(seal);
hostile.files["apps/mobile/src/services/diceLiveResultAdapter.ts"] = "0".repeat(64);
assert.throws(() => {
  if (hostile.package_sha256 !== packageSha(control, hostile.files)) throw new T307Stop("STOP_S2_T307_PACKAGE_DRIFT");
}, (error) => error.code === "STOP_S2_T307_PACKAGE_DRIFT");
console.log(`S2_T307_DICE_RELEASE_CANDIDATE_OK package_sha256=${seal.package_sha256}`);
