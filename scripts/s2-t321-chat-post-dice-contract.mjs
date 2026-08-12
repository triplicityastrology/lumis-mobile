import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const control = json("config/s2-t321-chat-post-dice-release-candidate.json");
const seal = json("config/s2-t321-chat-post-dice-release-candidate-seal.json");

assert.equal(control.status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.final_dice_evidence.accepted_source_commit, "8706db6cadbbf4ae0a58d10a194479a0c7aca465");
assert.equal(control.final_dice_evidence.accepted_source_tree, "edf01652aa245cc1bc202f3e3cee677b074a2565");
assert.equal(control.final_dice_evidence.accepted_release_package_sha256, "690879d6df3ecfd33a0a62ee0833f3bc278cfa11a2ab4062b8eba9eb659c1075");
assert.equal(control.final_dice_evidence.accepted_release_manifest_sha256, "1ef44fd42677e98fc3edd49e2e7ba6abf1257dbbfe9cdf597b68c0ae9239ef84");
assert.equal(control.final_dice_evidence.accepted_evidence_sha256, null);
assert.equal(control.next_action, "WAITING_FOR_ACCEPTED_T317_DICE_TECHNICAL_EVIDENCE");
assert.equal(control.chat_runtime.integration_enabled, false);
assert.equal(control.chat_runtime.traffic_enabled, false);
assert.equal(control.chat_runtime.normal_chat_connected, false);
assert.deepEqual(control.chat_runtime.request_fields, ["schema_version", "fixture_id"]);
assert.equal(control.dice_handoff.trigger, "explicit_reflect_in_chat");
assert.equal(control.dice_handoff.automatic_navigation, false);

for (const [path, expected] of Object.entries(seal.source_sha256)) assert.equal(sha256(path), expected, `${path} drift`);

const app = read("apps/mobile/App.tsx");
const dice = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const mobile = read("apps/mobile/src/services/chatPostDiceReleaseCandidate.ts");
const server = read("supabase/functions/_shared/chat-post-dice-release-candidate-v1.ts");
assert.match(app, /preserveApprovedDiceChatNavigation\(chatDraft\)/);
assert.match(dice, /buildReflectionPrompt\(activeQuestion, symbols, currentInterpretation\)/);
assert.match(dice, /onPress=\{\(\) => onReflect\(reflectionPrompt\)\}/);
assert.match(dice, /isCurrentDiceInterpretationRequest/);
assert.match(dice, /accessibilityLiveRegion="polite"/);
assert.match(dice, /DiceInterpretationCard/);
assert.match(dice, /ScrollView[\s\S]{0,180}Dice interpretation/);
assert.match(mobile, /CHAT_POST_DICE_INTEGRATION_ENABLED = false/);
assert.match(mobile, /CHAT_POST_DICE_TRAFFIC_ENABLED = false/);
assert.ok(mobile.indexOf("!CHAT_POST_DICE_INTEGRATION_ENABLED") < mobile.indexOf("input.create_transport"));
assert.match(server, /CHAT_POST_DICE_SERVER_ENABLED = false/);
assert.match(server, /CHAT_POST_DICE_SERVER_TRAFFIC_ENABLED = false/);
assert.ok(server.indexOf("!CHAT_POST_DICE_SERVER_ENABLED") < server.indexOf("return handleChatReleaseCandidate"));

const protectedChat = {
  "apps/mobile/src/services/chat.ts": "4a0b70e514c160dc55541e2909d45748347a76fe0561fb72de6a3d371a242392",
  "apps/mobile/src/components/ChatThinkingIndicator.tsx": "f5eaf0febeb1317f5df3a5c5658a1880c1bd0d2b5da2457edd4694a4514eadaa",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx": "669cf97c450d02662d572b92686d70af1f8c00810ac440f42221f982e3fdef70"
};
for (const [path, expected] of Object.entries(protectedChat)) assert.equal(sha256(path), expected, `${path} product drift`);

for (const path of [
  "supabase/tests/s2-t321-accepted-dice-evidence.schema.json",
  "supabase/tests/s2-t321-chat-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t321-chat-traffic-authorization.schema.json"
]) assert.equal(json(path).additionalProperties, false);

const normalImports = spawnSync("rg", ["-l", "chatPostDiceReleaseCandidate|chat-post-dice-release-candidate", "apps/mobile/App.tsx", "apps/mobile/src/services/chat.ts", "supabase/functions/chat-message"], { encoding: "utf8" });
assert.ok(normalImports.status === 1 && !normalImports.stdout.trim(), "normal Chat must not import T321 candidate");

for (const launcher of ["scripts/start-s2-t321-founder-chat-expo.sh", "scripts/start-s2-t321-founder-chat-web.sh", "scripts/start-s2-t321-founder-chat-simulator.sh"]) {
  const source = read(launcher);
  assert.match(source, /codex\/s2-t321-chat-post-dice-rc/);
  assert.doesNotMatch(source, /killall|pkill|kill -9|pnpm install|npm install/);
}
console.log("S2_T321_CHAT_POST_DICE_CONTRACT_OK");
