import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = "d40eb31415c6117e40323292a4c26f987aa80653";
const read = (path) => readFileSync(path, "utf8");
const baseScreen = execFileSync("git", ["show", `${BASE}:apps/mobile/src/features/dice/DiceRitualScreen.tsx`], { encoding: "utf8" });
const screen = read("apps/mobile/src/features/dice/DiceRitualScreen.tsx");
const route = read("apps/mobile/src/dev/FounderDiceInterpretationWorkbench.tsx");
const bank = read("apps/mobile/src/dev/founderDiceQuestionBank.ts");
const root = read("apps/mobile/index.ts");
const manifest = JSON.parse(read("config/s2-t297-dice-polished-e2e.json"));
const launchers = [
  [read("scripts/start-s2-t297-dice-polished-web.sh"), "8171", "--dev"],
  [read("scripts/start-s2-t297-dice-polished-simulator.sh"), "8172", "--ios"],
  [read("scripts/start-s2-t297-dice-polished-expo.sh"), "8173", "--lan"],
];

assert.equal(screen, baseScreen, "signed-off DiceRitualScreen blob must remain byte-identical to T295");

assert.match(route, /Founder Dice evidence controls outside the product screen/);
assert.match(route, /SAFE_STOP_DICE_INTERPRETATION_INTERFACE_SLOT_NOT_AUTHORIZED/);
assert.match(route, /provider 0 · persistence 0 · units 0/);
assert.doesNotMatch(route, /developmentBoundary=/);
assert.match(route, /ZH08 bundled rejection/);
assert.match(route, /ZH09 accepted control/);
assert.match(route, /<DiceRitualScreen/);
assert.match(root, /__DEV__ && process\.env\.EXPO_PUBLIC_FOUNDER_DICE_POLISHED_E2E === "1"/);

assert.match(bank, /FOUNDER_EXCLUDED_ZH_AUTHORING_ID = "ZH04"/);
assert.match(bank, /STOP_S2_T297_ONLY_ZH04_EXCLUSION_AUTHORIZED/);
assert.equal(manifest.question_bank.supplied, 41);
assert.equal(manifest.question_bank.en_selected, 20);
assert.equal(manifest.question_bank.zh_Hant_selected, 20);
assert.equal(manifest.question_bank.excluded_authoring_id, "ZH04");
assert.equal(manifest.effects.provider_calls, 0);
assert.equal(manifest.effects.persistence_writes, 0);
assert.equal(manifest.effects.units_charged, 0);
assert.equal(manifest.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

for (const [source, port, marker] of launchers) {
  assert.match(source, new RegExp(port));
  assert.match(source, new RegExp(marker));
  assert.match(source, /codex\/s2-t297-dice-polished-e2e/);
  assert.match(source, /git status --porcelain --untracked-files=no/);
  assert.doesNotMatch(source, /kill -9|pkill|killall|pnpm install/);
}
const launcherText = launchers.map(([source]) => source).join("\n");
for (const protectedPort of ["8124", "8125", ...Array.from({ length: 31 }, (_, index) => String(8140 + index))]) {
  assert.doesNotMatch(launcherText, new RegExp(`--port ["']?${protectedPort}(?:\\D|$)`));
}

console.log("S2-T297 polished Dice external-boundary contract passed");
