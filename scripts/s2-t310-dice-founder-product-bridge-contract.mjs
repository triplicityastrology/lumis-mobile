import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "a4aa42f90cbbf36cfeec32015e255dec24b7d604";
const read = (path) => readFileSync(path, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const control = JSON.parse(read("config/s2-t310-dice-founder-product-bridge.json"));
const bridge = read("apps/mobile/src/services/diceFounderProductBridge.ts");
const workbench = read("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx");
const launcher = read("scripts/start-s2-t310-dice-founder-product-bridge.sh");

for (const [path, expected] of Object.entries(control.protected_product_sources)) {
  const current = read(path);
  const base = execFileSync("git", ["show", `${BASE}:${path}`]);
  assert.deepEqual(Buffer.from(current), base, `${path} must remain byte-identical to T302`);
  assert.equal(execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim(), expected.git_blob);
  assert.equal(sha256(current), expected.sha256);
}

const dice = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
assert.match(dice, /DiceInterpretationCard/);
assert.match(dice, /maxHeight: 176/);
assert.match(dice, /label="Reflect in Chat"/);
assert.match(dice, /DIE_ORDER\.map/);
assert.match(dice, /onInterpretationRequested/);
assert.match(dice, /onRetryInterpretation/);

for (const path of [
  "apps/mobile/src/components/ChatThinkingIndicator.tsx",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx",
]) {
  assert.deepEqual(readFileSync(path), execFileSync("git", ["show", `${BASE}:${path}`]), `${path} approved pixels must not change`);
}

const app = read("apps/mobile/App.tsx");
const baseApp = execFileSync("git", ["show", `${BASE}:apps/mobile/App.tsx`], { encoding: "utf8" });
assert.equal(app.slice(app.indexOf("function ChatShellScreen")), baseApp.slice(baseApp.indexOf("function ChatShellScreen")), "signed-off Chat shell and pixels must remain byte-identical");
const appDiff = execFileSync("git", ["diff", BASE, "--", "apps/mobile/App.tsx"], { encoding: "utf8" });
assert.match(appDiff, /preserveApprovedDiceChatNavigation/);
assert.match(appDiff, /setPendingChatDraft\(handoff\.chat_draft\)/);
assert.match(appDiff, /setScreen\(handoff\.target\)/);
assert.doesNotMatch(appDiff, /function ChatShellScreen|messageBubble|ChatThinkingIndicator|ChatFailedReply/);

assert.match(bridge, /createDiceLiveResultAdapter/);
assert.match(bridge, /preserveApprovedDiceChatNavigation/);
assert.match(bridge, /signed_off_dice_result_card/);
assert.match(bridge, /kind: "result"/);
assert.doesNotMatch(bridge, /CHAT_PRESENTATION_AUTHORITY|signed_off_chat_assistant_state/);
assert.doesNotMatch(bridge, /fetch\(|supabase|azure|bearer|api[_-]?key|endpoint/i);
assert.match(workbench, /createDiceFounderProductBridge/);
assert.match(workbench, /ai_enabled: false, traffic_authorized: false, authority: null/);
assert.match(workbench, /Offline interpretation preview/);
assert.equal(control.mobile_gateway_request_fields.join(","), "fixture_id");
assert.equal(control.provider_calls_default, 0);
assert.equal(control.persistence_writes_default, 0);
assert.equal(control.units_charged_default, 0);
assert.equal(control.normal_chat_authority, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.azure_traffic_authority, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.match(launcher, /codex\/s2-t310-dice-founder-product-bridge/);
assert.match(launcher, /8180/);
assert.match(launcher, /EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E=1/);
assert.doesNotMatch(launcher, /kill -9|pkill|killall|pnpm install/);

const bankFixture = read("apps/mobile/src/dev/founderDiceQuestionBank.fixtures.ts");
assert.match(bankFixture, /FOUNDER_EXCLUDED_ZH_AUTHORING_ID === "ZH04"/);
assert.match(bankFixture, /ZH08/);
assert.match(bankFixture, /ZH09/);

console.log("S2-T310 Dice Founder product bridge source contract passed");
