#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const control = json("config/s2-t331-chat-after-dice-root.json");
const seal = json("config/s2-t331-chat-after-dice-root-seal.json");

assert.equal(control.base_commit, "451ff5a89dab07c9c61ec50489459b09974bb7e7");
assert.equal(control.source_roots.t317_final_release.package_sha256, "749c0c0910cdde915d7ab008ecb92b0471cefc795935e47b1e1a2b74451e0c69");
assert.equal(control.source_roots.t322_actual_product_pre_roll.package_sha256, "7675005910e519cdaba9035e33285cf1bd4390ba5b2702d20c241089f3991735");
assert.match(control.source_roots.t317_final_release.status, /^source_complete_/);
assert.match(control.source_roots.t322_actual_product_pre_roll.status, /^source_complete_/);
assert.equal(control.gates.chat_deployment_enabled, false);
assert.equal(control.gates.chat_synthetic_traffic_enabled, false);
assert.equal(control.effects.future_success_requires_atomic_outcome, true);
assert.equal(control.effects.failure_persistence_writes, 0);
assert.equal(control.effects.failure_units_charged, 0);
assert.equal(control.independence.normal_chat_unchanged, true);
assert.equal(control.independence.chat_ui_unchanged, true);
assert.equal(control.independence.automatic_dice_navigation, false);
assert.deepEqual(control.founder_disabled_matrix.languages, ["en", "zh-Hant"]);
assert.deepEqual(control.founder_disabled_matrix.states, ["loading", "result", "safety", "fallback", "retry"]);
assert.equal(control.status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
for (const [path, expected] of Object.entries(seal.source_sha256)) assert.equal(sha(path), expected, `${path} seal drift`);
assert.match(seal.package_sha256, /^[a-f0-9]{64}$/);

const mobile = read("apps/mobile/src/services/chatAfterDiceRoot.ts");
const server = read("supabase/functions/_shared/chat-after-dice-root-v1.ts");
assert.match(mobile, /CHAT_AFTER_DICE_DEPLOYMENT_ENABLED = false/);
assert.match(mobile, /CHAT_AFTER_DICE_SYNTHETIC_TRAFFIC_ENABLED = false/);
assert.match(mobile, /buildExplicitDiceReflectHandoff/);
assert.match(mobile, /startChatProductPath/);
assert.match(mobile, /validateNormalChatCandidateResponse/);
assert.match(mobile, /assertZeroEffectNonSuccess/);
assert.ok(mobile.indexOf("!CHAT_AFTER_DICE_DEPLOYMENT_ENABLED") < mobile.indexOf("input.create_transport"));
assert.match(server, /CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED = false/);
assert.match(server, /CHAT_AFTER_DICE_SERVER_SYNTHETIC_TRAFFIC_ENABLED = false/);
assert.ok(server.indexOf("!CHAT_AFTER_DICE_SERVER_DEPLOYMENT_ENABLED") < server.indexOf("validateT331Authorities"));

for (const path of [
  "supabase/tests/s2-t331-corrected-dice-evidence.schema.json",
  "supabase/tests/s2-t331-chat-default-off-deployment.schema.json",
  "supabase/tests/s2-t331-chat-synthetic-traffic.schema.json",
]) assert.equal(json(path).additionalProperties, false);

const protectedSources = {
  "apps/mobile/src/services/chat.ts": "4a0b70e514c160dc55541e2909d45748347a76fe0561fb72de6a3d371a242392",
  "apps/mobile/src/components/ChatThinkingIndicator.tsx": "f5eaf0febeb1317f5df3a5c5658a1880c1bd0d2b5da2457edd4694a4514eadaa",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx": "669cf97c450d02662d572b92686d70af1f8c00810ac440f42221f982e3fdef70",
  "apps/mobile/src/dev/FounderPolishedChatExperience.tsx": "15298ecc60997611600d884aa566268e3cc93134d8d5aa0da2d864a2ecdac8b4",
};
for (const [path, expected] of Object.entries(protectedSources)) assert.equal(sha(path), expected, `${path} drift`);

const normalRuntime = `${read("apps/mobile/src/services/chat.ts")}\n${read("supabase/functions/chat-message/index.ts")}`;
assert.doesNotMatch(normalRuntime, /chatAfterDiceRoot|chat-after-dice-root|s2_t331/i);
console.log("S2_T331_CHAT_AFTER_DICE_CONTRACT_OK");
