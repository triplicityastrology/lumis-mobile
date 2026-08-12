import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const control = json("config/s2-t326-chat-product-path.json");
const seal = json("config/s2-t326-chat-product-path-seal.json");

assert.equal(control.source_parent, "582185d6fbb380cf6777f970afcd5bbc56983b68");
assert.equal(control.status.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.status.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.mobile.integration_enabled, false);
assert.equal(control.mobile.traffic_enabled, false);
assert.equal(control.server.integration_enabled, false);
assert.equal(control.server.traffic_enabled, false);
assert.equal(control.dice_handoff.trigger, "explicit_reflect_in_chat");
assert.equal(control.dice_handoff.automatic_navigation, false);
assert.deepEqual(control.mobile.fixture_ids, ["chat-en-reflection-01", "chat-zh-hant-reflection-01"]);
assert.equal(control.effects.atomic_success_required, true);
assert.equal(control.effects.non_success_persistence_writes, 0);
assert.equal(control.effects.non_success_units_charged, 0);

for (const [path, expected] of Object.entries(seal.source_sha256)) assert.equal(sha(path), expected, `${path} drift`);
assert.match(seal.package_sha256, /^[a-f0-9]{64}$/);
for (const path of [
  "supabase/tests/s2-t326-chat-default-off-deployment.schema.json",
  "supabase/tests/s2-t326-chat-synthetic-traffic.schema.json",
]) assert.equal(json(path).additionalProperties, false);

const mobile = read("apps/mobile/src/services/chatProductPathCandidate.ts");
const handoff = read("apps/mobile/src/services/chatPostDiceReleaseCandidate.ts");
const server = read("supabase/functions/_shared/chat-product-path-candidate-v1.ts");
const founder = read("apps/mobile/src/dev/FounderPolishedChatExperience.tsx");
assert.match(mobile, /CHAT_PRODUCT_PATH_INTEGRATION_ENABLED = false/);
assert.match(mobile, /CHAT_PRODUCT_PATH_TRAFFIC_ENABLED = false/);
assert.ok(mobile.indexOf("!CHAT_PRODUCT_PATH_INTEGRATION_ENABLED") < mobile.indexOf("input.create_transport"));
assert.match(handoff, /parseApprovedDiceDraft/);
assert.match(handoff, /provenance: "explicit_reflect_in_chat"/);
assert.match(server, /CHAT_PRODUCT_PATH_SERVER_ENABLED = false/);
assert.match(server, /CHAT_PRODUCT_PATH_SERVER_TRAFFIC_ENABLED = false/);
assert.ok(server.indexOf("!CHAT_PRODUCT_PATH_SERVER_ENABLED") < server.indexOf("return handleChatPostDiceReleaseCandidate"));
assert.match(founder, /KeyboardAvoidingView/);
assert.match(founder, /maxFontSizeMultiplier=\{MAX_FONT_SCALE\}/);
assert.match(founder, /accessibilityLiveRegion="polite"/);
assert.match(founder, /scenario === "safety"/);
assert.match(founder, /scenario === "fallback"/);
assert.match(founder, /ChatFailedReply onNewTopic=\{reset\} onRetry=\{retry\}/);
assert.match(founder, /keyboardShouldPersistTaps="handled"/);

const normalImports = spawnSync("rg", ["-l", "chatProductPathCandidate|chat-product-path-candidate", "apps/mobile/src/services/chat.ts", "supabase/functions/chat-message"], { encoding: "utf8" });
assert.equal(normalImports.status, 1, "normal Chat must remain independent");
const protectedChat = {
  "apps/mobile/src/services/chat.ts": "4a0b70e514c160dc55541e2909d45748347a76fe0561fb72de6a3d371a242392",
  "apps/mobile/src/components/ChatThinkingIndicator.tsx": "f5eaf0febeb1317f5df3a5c5658a1880c1bd0d2b5da2457edd4694a4514eadaa",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx": "669cf97c450d02662d572b92686d70af1f8c00810ac440f42221f982e3fdef70",
};
for (const [path, expected] of Object.entries(protectedChat)) assert.equal(sha(path), expected, `${path} product drift`);

console.log("S2_T326_CHAT_PRODUCT_CONTRACT_OK");
