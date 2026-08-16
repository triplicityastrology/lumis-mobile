#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AC_DICE_09_HEADINGS, INTEGRATED_T356_COMMIT, INTEGRATED_T357_COMMIT, INTEGRATED_T358_COMMIT, validateIntegrationManifest, validateProofReceipt } from "./s2-t359-dice-live-proof.mjs";

const hex = (seed) => createHash("sha256").update(seed).digest("hex");
const commit = (seed) => createHash("sha1").update(seed).digest("hex");
const manifest = validateIntegrationManifest({
  schema: "lumis_s2_t359_integration_manifest_v1", integrated_commit: commit("integrated"),
  t356_commit: INTEGRATED_T356_COMMIT, t356_package_sha256: hex("t356-package"),
  t357_commit: INTEGRATED_T357_COMMIT, t357_package_sha256: hex("t357-package"),
  t358_commit: INTEGRATED_T358_COMMIT, t358_package_sha256: hex("t358-package"),
  web_build_marker: commit("integrated"), mobile_build_marker: commit("integrated"),
  web_launcher: "scripts/start-founder-dice-web-lab-live.sh", web_launcher_sha256: hex("web-launcher"),
  mobile_launcher: "scripts/start-founder-live-mobile-dice-ssd.sh", mobile_launcher_sha256: hex("mobile-launcher"),
  web_url: "http://127.0.0.1:8147", mobile_expo_url: "exp://192.168.0.185:8222",
  mobile_relay_url: "http://192.168.0.185:8223", local_consumption_lock: false
});
assert(manifest);
const manifestSha = hex("manifest");
const run = (sequence, language, planet, sign, house, retry = 0) => ({
  sequence, captured_at: `2026-08-16T00:00:0${sequence}.000Z`, question_sha256: hex(`question-${sequence}-${language}`),
  response_sha256: hex(`response-${sequence}-${language}`), language,
  landing: { planet_id: planet, sign_id: sign, house_id: house }, result_schema: "lumis_dice_v0_3_result_v2",
  presentation: { opening_unheaded: true, headings: AC_DICE_09_HEADINGS[language] }, outcome: "completed", retry_count: retry
});
const webRuns = [run(1, "en", "sun", "aries", "house_1"), run(2, "zh-Hant", "moon", "taurus", "house_2"), run(3, "en", "mercury", "gemini", "house_3")];
const mobileRuns = [run(1, "zh-Hant", "venus", "cancer", "house_4"), run(2, "en", "mars", "leo", "house_5", 1), run(3, "zh-Hant", "jupiter", "virgo", "house_6")];
const receipt = {
  schema: "lumis_s2_t359_live_proof_receipt_v1", integration_manifest_sha256: manifestSha, local_consumption_lock: false,
  web: { build_marker: manifest.integrated_commit, input_mode: "free_text", controls: { question: true, planet_count: 12, sign_count: 12, house_count: 12, run: true, response: true }, runs: webRuns },
  mobile: { build_marker: manifest.integrated_commit, result_surface: { result_card: true, roll_again: true, reflect_in_chat: true }, runs: mobileRuns },
  human_verdict: "pending"
};
assert.equal(validateProofReceipt(receipt, manifest, manifestSha), true);
assert.equal(validateProofReceipt({ ...receipt, local_consumption_lock: true }, manifest, manifestSha), false);
assert.equal(validateProofReceipt({ ...receipt, web: { ...receipt.web, build_marker: hex("stale") } }, manifest, manifestSha), false);
assert.equal(validateProofReceipt({ ...receipt, web: { ...receipt.web, runs: [webRuns[0], webRuns[0], webRuns[2]] } }, manifest, manifestSha), false);
assert.equal(validateProofReceipt({ ...receipt, mobile: { ...receipt.mobile, runs: mobileRuns.map((entry) => ({ ...entry, retry_count: 0 })) } }, manifest, manifestSha), false);
assert.equal(validateProofReceipt({ ...receipt, raw_response: "forbidden" }, manifest, manifestSha), false);
assert.equal(validateIntegrationManifest({ ...manifest, mobile_expo_url: "exp://example.com:8222" }), null);
assert.equal(validateIntegrationManifest({ ...manifest, t358_commit: hex("wrong-t358") }), null);

const launcher = readFileSync("scripts/start-s2-t359-dice-live-proof.sh", "utf8");
assert.match(launcher, /s2-t359-dice-live-proof\.mjs" preflight/);
assert.match(launcher, /LUMIS_T359_INTEGRATION_MANIFEST/);
assert.match(launcher, /LUMIS_T359_PROOF_RECEIPT/);
assert.doesNotMatch(launcher, /supabase functions deploy|migration up|LUMIS_DICE_AI_ENABLED=true|security find-generic-password|curl .*functions\/v1/);
console.log("S2-T359 Dice live proof contract passed");
