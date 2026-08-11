import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const manifest = JSON.parse(read("config/s2-t295-founder-question-bank-manifest.json"));
const bank = read("apps/mobile/src/dev/founderDiceQuestionBank.ts");
const panel = read("apps/mobile/src/dev/FounderDiceQuestionBankPanel.tsx");
const consoleSource = read("apps/mobile/src/dev/FounderAiQualityReviewConsole.tsx");
const launchers = [
  [read("scripts/start-s2-t295-founder-question-bank-web.sh"), "8163", "--dev"],
  [read("scripts/start-s2-t295-founder-question-bank-simulator.sh"), "8164", "expo start"],
  [read("scripts/start-s2-t295-founder-question-bank-expo.sh"), "8165", "--lan"],
];

assert.equal(manifest.drafts.total, 41);
assert.equal(manifest.drafts.en, 20);
assert.equal(manifest.drafts["zh-Hant"], 21);
assert.deepEqual(manifest.drafts.non_excludable_authoring_ids, ["ZH08", "ZH09"]);
assert.equal(manifest.selection_instruction, "Founder excluded ZH04; exactly 20 zh-Hant entries are selected");
assert.equal(manifest.registry.excluded_authoring_id, "ZH04");
assert.equal(manifest.registry.runtime_available, false);
assert.deepEqual(manifest.registry.runtime_request_fields, ["fixture_id"]);
assert.equal(manifest.effects.provider_calls, 0);
assert.equal(manifest.effects.persistence_writes, 0);
assert.equal(manifest.effects.units_charged, 0);
assert.equal(manifest.authority.normal_chat, "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY");
assert.equal(manifest.authority.azure_traffic, "NO_AZURE_TRAFFIC_AUTHORITY");

assert.match(bank, /NON_EXCLUDABLE_ZH_AUTHORING_IDS = Object\.freeze\(\["ZH08", "ZH09"\]/);
assert.match(bank, /STOP_S2_T297_ZH04_EXCLUSION_REQUIRED/);
assert.match(bank, /STOP_S2_T295_CONTROL_QUESTION_NON_EXCLUDABLE/);
assert.match(bank, /runtime_request_fields: Object\.freeze\(\["fixture_id"\]/);
assert.match(panel, /FOUNDER_SELECTION_INSTRUCTION/);
assert.match(panel, /ZH04 excluded/);
assert.match(panel, /Download rating \/ review export/);
assert.match(panel, /Runtime accepts fixture_id only · unavailable/);
assert.match(consoleSource, /FounderDiceQuestionBankPanel/);

for (const [source, port, marker] of launchers) {
  assert.match(source, new RegExp(port));
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /codex\/s2-t295-founder-question-bank/);
  assert.match(source, /git status --porcelain --untracked-files=no/);
  assert.doesNotMatch(source, /kill -9|pkill|killall/);
}
for (const protectedPort of ["8124", "8125", ...Array.from({ length: 23 }, (_, index) => String(8140 + index))]) {
  assert.doesNotMatch(launchers.map(([source]) => source).join("\n"), new RegExp(`--port ["']?${protectedPort}(?:\\D|$)`));
}

console.log("S2-T295 Founder question bank source contract passed");
