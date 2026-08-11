import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const product = read("apps/mobile/src/dev/FounderPolishedChatExperience.tsx");
const contract = read("apps/mobile/src/dev/founderPolishedChatContract.ts");
const t240 = read("apps/mobile/src/dev/founderCompanionChatContract.ts");
const index = read("apps/mobile/index.ts");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const parent = execFileSync("git", ["rev-parse", "HEAD^"], { encoding: "utf8" }).trim();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();

assert.ok(head === "ad36ddc46f0f46cb473f86aae77b284f73439223" || parent === "ad36ddc46f0f46cb473f86aae77b284f73439223");
assert.equal(branch, "codex/s2-t299-chat-polished-e2e");

assert.match(index, /__DEV__ && process\.env\.EXPO_PUBLIC_FOUNDER_POLISHED_CHAT === "1"/);
assert.ok(index.indexOf("FOUNDER_POLISHED_CHAT_ENABLED") < index.indexOf("FOUNDER_COMPANION_CHAT_ENABLED\n      ?"));
assert.match(product, /Founder evidence controls outside product pixels/);
assert.match(product, /S2_T299_POLISHED_CHAT_ROUTE/);
assert.match(product, /Founder Talk preview · offline fixture/);
assert.match(product, /What feels most worth understanding today/);
assert.match(product, /Reflecting\.\.\./);
assert.match(product, /ChatFailedReply/);
assert.match(product, /KeyboardAvoidingView/);
assert.match(product, /keyboardDismissMode="interactive"/);
assert.match(product, /maxFontSizeMultiplier=\{MAX_FONT_SCALE\}/);
assert.match(contract, /provider_calls: 0/);
assert.match(contract, /units_charged: 0/);
assert.match(contract, /persistence_writes: 0/);
assert.match(contract, /thread_writes: 0/);
assert.match(contract, /message_writes: 0/);
assert.match(contract, /member_context: false/);
assert.match(contract, /WAITING_FOR_ACCEPTED_DICE_TECHNICAL_EVIDENCE_AND_CHAT_AUTHORITY/);
assert.match(contract, /T240_FIXED_FALLBACK/);
assert.match(contract, /T240_SAFETY_REDIRECT/);
assert.match(t240, /Lumis couldn’t complete that reflection just now\. Please try again\./);
assert.match(t240, /Lumis can’t help with that request, but it can offer a safer, general reflection instead\./);

for (const forbidden of [
  /sendChatMessage/,
  /getSupabaseClient/,
  /chat-message/,
  /thread_id/,
  /member_id/,
  /account_id/,
  /fetch\(/,
  /console\.(?:log|warn|error)/,
]) {
  assert.doesNotMatch(product, forbidden);
}

for (const file of [
  "scripts/start-s2-t299-founder-chat-web.sh",
  "scripts/start-s2-t299-founder-chat-simulator.sh",
  "scripts/start-s2-t299-founder-chat-expo.sh",
]) {
  const source = read(file);
  assert.match(source, /PORT >= 8171/);
  assert.doesNotMatch(source, /killall|pkill|kill -9|pnpm install|npm install/);
  assert.match(source, /EXPO_PUBLIC_FOUNDER_POLISHED_CHAT=1/);
}

const changed = process.argv.slice(2);
for (const file of changed) {
  assert.doesNotMatch(file, /^apps\/mobile\/src\/(?:features\/dice|screens\/Dice|components\/dice)/i);
  assert.doesNotMatch(file, /^supabase\/functions\/chat-message\//);
  assert.doesNotMatch(file, /^apps\/mobile\/src\/services\/chat\.ts$/);
}

console.log("S2_T299_FOUNDER_POLISHED_CHAT_CONTRACT_OK");
