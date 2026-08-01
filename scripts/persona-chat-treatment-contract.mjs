import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const indicator = readFileSync(
  "apps/mobile/src/components/ChatThinkingIndicator.tsx",
  "utf8"
);
const treatment = readFileSync(
  "apps/mobile/src/features/chat/personaChatTreatment.ts",
  "utf8"
);

assert.match(app, /resolvePersonaChatTreatment\(selectedStyle\)/);
assert.match(app, /function LumisChatAvatar/);
assert.match(app, /<LumisPersonaAvatar avatarKey=\{avatarKey\} size=\{26\}/);
assert.match(app, /messageBubbleLumisSubtle/);
assert.match(app, /<ChatThinkingIndicator\s*\/>/);
assert.doesNotMatch(app, /ChatThinkingIndicator[^>]*personaTreatment|ChatThinkingIndicator[^>]*color=/);
assert.doesNotMatch(app, /PersonaChatMarker|Lumis marker/);
assert.match(indicator, /ChatThinkingIndicator\(\)/);
assert.match(indicator, /const DEFAULT_GOLD = "#E8C98D"/);
assert.match(indicator, /reduceMotionChanged/);
assert.match(treatment, /acceptance:[\s\S]*#B8A7E8/);
assert.match(treatment, /spark:[\s\S]*#F3C96F/);

console.log("persona-aware Chat treatment contract passed");
