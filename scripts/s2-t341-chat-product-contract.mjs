import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const control = json("config/s2-t341-chat-product-integration-rc.json");
const seal = json("config/s2-t341-chat-product-integration-rc-seal.json");
const app = read("apps/mobile/App.tsx");
const service = read("apps/mobile/src/services/chatProductIntegrationRc.ts");
const server = read("supabase/functions/_shared/normal-chat-ai-candidate-v1.ts");
const launcher = read("scripts/start-s2-t341-chat-product.sh");

assert.equal(control.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(control.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");
assert.equal(control.source_switches.integration_enabled, false);
assert.equal(control.source_switches.traffic_enabled, false);
assert.match(service, /CHAT_PRODUCT_INTEGRATION_ENABLED = false/);
assert.match(service, /CHAT_PRODUCT_TRAFFIC_ENABLED = false/);
assert.match(server, /NORMAL_CHAT_AI_INTEGRATION_ENABLED = false/);
assert.match(server, /NORMAL_CHAT_AI_TRAFFIC_ENABLED = false/);
assert.match(server, /Admission precedes request parsing, auth\/database access and provider\/client construction/);

assert.match(app, /sendChatProductIntegrationMessage/);
assert.doesNotMatch(app, /await sendChatMessage\(/);
assert.match(app, /<ChatThinkingIndicator \/>/);
assert.match(app, /<ChatFailedReply/);
assert.match(app, /Reflecting\.\.\./);
assert.match(app, /What feels most worth understanding today\?/);
assert.match(app, /Reflective guidance, not professional advice\./);
assert.doesNotMatch(app, /\{T341_CHAT_FIXTURE_STATE\}/);
assert.doesNotMatch(app, /local deterministic|fixture state|offline preview/i);
assert.match(app, /setPendingChatDraft\(productPayload\.chat_draft\);\s*setScreen\(handoff\.target\)/s);
const reflectStart = app.indexOf("onReflect={(chatDraft)");
const reflectEnd = app.indexOf("onSelectTab={openMainTab}", reflectStart);
assert.ok(reflectStart >= 0 && reflectEnd > reflectStart, "explicit Dice handoff block exists");
assert.doesNotMatch(app.slice(reflectStart, reflectEnd), /sendChatProductIntegrationMessage|handleSend\(/);

assert.match(launcher, /EXPO_PUBLIC_T341_CHAT_LOCAL_FIXTURE=1/);
assert.match(launcher, /EXPO_PUBLIC_SUPABASE_URL=/);
assert.match(launcher, /SSD_WORKTREE_REQUIRED/);
assert.match(launcher, /PORT_OCCUPIED_NO_PROCESS_KILLED/);
assert.doesNotMatch(launcher, /kill |pkill|rm -rf|pnpm install|npm install/);

for (const [path, expected] of Object.entries(seal.source)) assert.equal(sha(read(path)), expected, path);
assert.equal(seal.package_sha256, sha(JSON.stringify(seal.source)));

const changed = execFileSync("git", ["diff", "--name-only", control.base_commit, "--"], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
for (const protectedPath of [
  "apps/mobile/src/components/ChatThinkingIndicator.tsx",
  "apps/mobile/src/features/chat/ChatConfirmationCards.tsx",
  "apps/mobile/src/components/LumisPersonaAvatar.tsx",
  "apps/mobile/src/theme/typography.ts",
]) assert.equal(changed.includes(protectedPath), false, `${protectedPath} must remain byte-identical`);

console.log("S2_T341_CHAT_PRODUCT_CONTRACT_OK");
