#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const control = json("config/s2-t336-chat-after-dice-product.json");
const seal = json("config/s2-t336-chat-after-dice-product-seal.json");

assert.equal(control.base_commit, "8fd00bcfcd110c07d7ef83d6adc0b061282da29b");
assert.equal(control.candidate.integration_enabled, false);
assert.equal(control.candidate.traffic_enabled, false);
assert.equal(control.candidate.product_surface, "unchanged_founder_polished_chat_pixels");
assert.equal(control.final_dice_evidence.required_schema, "s2_t331_corrected_dice_evidence_acceptance_v1");
assert.equal(control.final_dice_evidence.accepted_evidence_sha256, null);
assert.deepEqual(control.reflect_payload.fields, ["action", "question", "results", "interpretation"]);
assert.equal(control.reflect_payload.result_count, 3);
assert.equal(control.reflect_payload.automatic_navigation, false);
assert.equal(control.reflect_payload.duplicate_ai_call_blocked, true);
assert.deepEqual(control.truthful_states.languages, ["en", "zh-Hant"]);
assert.deepEqual(control.truthful_states.phases, ["loading", "completed", "fallback", "safety", "technical_error"]);
assert.equal(control.truthful_states.technical_assistant_message, null);
for (const key of ["normal_member_activation", "provider", "persistence", "charging", "deployment", "public_route"]) {
  assert.equal(control.authority[key], false, `${key} must remain false`);
}

for (const [path, expected] of Object.entries(seal.source_sha256)) assert.equal(sha(path), expected, `${path} seal drift`);
assert.match(seal.package_sha256, /^[a-f0-9]{64}$/);
for (const path of [
  "supabase/tests/s2-t336-explicit-reflect-payload.schema.json",
  "supabase/tests/s2-t336-final-dice-evidence-binding.schema.json",
]) assert.equal(json(path).additionalProperties, false);

const mobile = read("apps/mobile/src/services/chatAfterDiceProductCandidate.ts");
assert.match(mobile, /CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED = false/);
assert.match(mobile, /CHAT_AFTER_DICE_PRODUCT_TRAFFIC_ENABLED = false/);
assert.match(mobile, /exactKeys\(value, \["action", "question", "results", "interpretation"\]\)/);
assert.match(mobile, /value\.results\.length !== 3/);
assert.match(mobile, /validateCorrectedDiceEvidence/);
assert.match(mobile, /validateNormalChatCandidateResponse/);
assert.match(mobile, /assertZeroEffectNonSuccess/);
assert.match(mobile, /assistantMessage !== T240_FIXED_FALLBACK/);
assert.match(mobile, /assistantMessage !== T240_SAFETY_REDIRECT/);
assert.match(mobile, /CHAT_AFTER_DICE_DUPLICATE_AI_CALL_BLOCKED/);
assert.ok(mobile.indexOf("!CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED") < mobile.indexOf("input.create_transport"));
assert.ok(mobile.indexOf("!CHAT_AFTER_DICE_PRODUCT_INTEGRATION_ENABLED") < mobile.indexOf("buildExplicitReflectPayload(input.reflect_payload)"));

const protectedSources = {
  "apps/mobile/src/services/chat.ts": "4a0b70e514c160dc55541e2909d45748347a76fe0561fb72de6a3d371a242392",
  "apps/mobile/src/components/ChatThinkingIndicator.tsx": "f5eaf0febeb1317f5df3a5c5658a1880c1bd0d2b5da2457edd4694a4514eadaa",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx": "669cf97c450d02662d572b92686d70af1f8c00810ac440f42221f982e3fdef70",
  "apps/mobile/src/dev/FounderPolishedChatExperience.tsx": "15298ecc60997611600d884aa566268e3cc93134d8d5aa0da2d864a2ecdac8b4",
};
for (const [path, expected] of Object.entries(protectedSources)) assert.equal(sha(path), expected, `${path} pixel/runtime drift`);

const normalImports = spawnSync("rg", [
  "-l",
  "chatAfterDiceProductCandidate|s2_t336|s2-t336",
  "apps/mobile/App.tsx",
  "apps/mobile/src/services/chat.ts",
  "supabase/functions/chat-message",
], { encoding: "utf8" });
assert.ok(normalImports.status === 1 && !normalImports.stdout.trim(), "normal Chat must not import T336");

for (const launcher of [
  "scripts/start-s2-t336-founder-chat-expo.sh",
  "scripts/start-s2-t336-founder-chat-simulator.sh",
]) {
  const source = read(launcher);
  assert.match(source, /ROOT="\$\(cd "\$\(dirname "\$0"\)\/\.\." && pwd -P\)"/);
  assert.match(source, /codex\/s2-t336-chat-after-dice-ssd/);
  assert.match(source, /EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1/);
  assert.match(source, /EXPO_PUBLIC_SUPABASE_URL=/);
  assert.doesNotMatch(source, /\/Users\/|\/Volumes\/|killall|pkill|kill -9|pnpm install|npm install/);
}
console.log("S2_T336_CHAT_AFTER_DICE_PRODUCT_CONTRACT_OK");
