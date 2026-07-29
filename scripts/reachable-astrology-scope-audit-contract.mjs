import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const audit = read("docs/qa/S2-reachable-astrology-scope-readiness-audit.md");
const app = read("apps/mobile/App.tsx");
const insights = read("apps/mobile/src/screens/ChartInsightsScreen.tsx");
const home = read("apps/mobile/src/screens/LumisHomeScreen.tsx");
const localChat = read("apps/mobile/src/services/chat.ts");
const router = read("packages/shared/src/config/chat-router.ts");
const edgeChat = read("supabase/functions/chat-message/index.ts");

assert.match(audit, /Status: inactive audit only/);
for (const scopeRule of [
  "current Knowledge Bank and deterministic chart scope is natal only",
  "Transit, timing, date ranking, weekly forecasting, and advanced methods are",
  "Solar Return is permanently outside Lumis scope",
  "Dice is a separate product surface and is excluded from the Knowledge Bank",
]) {
  assert.match(audit, new RegExp(scopeRule));
}

for (const id of Array.from({ length: 14 }, (_, index) => `AS-${String(index + 1).padStart(2, "0")}`)) {
  assert.match(audit, new RegExp(`\\| ${id} \\|`), `${id} must remain classified`);
}

for (const path of [
  "apps/mobile/src/screens/ChartInsightsScreen.tsx",
  "apps/mobile/App.tsx",
  "apps/mobile/src/screens/LumisHomeScreen.tsx",
  "apps/mobile/src/services/chat.ts",
  "packages/shared/src/config/chat-router.ts",
  "supabase/functions/chat-message/index.ts",
  "packages/shared/src/config/routes.ts",
  "packages/shared/src/config/entitlements.ts",
  "apps/mobile/dist-qa/_expo/static/js/web/index-2332b8cea52233a52e72cd6265f491df.js",
]) {
  assert.ok(audit.includes(`\`${path}\``), `${path} must remain in the source audit`);
}

assert.match(insights, /THIS WEEK'S SKY/);
assert.match(insights, /The Moon moves through grounding ground midweek/);
assert.match(app, /What should I pay attention to this week\?/);
assert.match(app, /Timing window · planning aid, not a guarantee/);
assert.match(app, /\{ key: "timing", label: "Timing" \}/);
assert.match(home, /Gentle prompts for timing, patterns, and growth\./);

assert.match(
  localChat,
  /Timing guidance is not active in this preview\.[\s\S]*grounded in your natal chart/
);
assert.match(
  router,
  /transit\|timing\|this month\|this week\|forecast[\s\S]*return "astro_timing"/
);
assert.match(edgeChat, /classifyChatRoute\(message\)/);
assert.match(router, /OUT_OF_SCOPE_SOLAR_RETURN_EN = "Solar Return is not part of Lumis\."/);
assert.match(router, /OUT_OF_SCOPE_SOLAR_RETURN_ZH_HANT/);
assert.match(router, /isSolarReturnRequest[\s\S]*return "out_of_scope"/);

for (const safeOption of [
  "explicitly labelled inactive preview",
  "Hide until approved",
  "internal fixture/test data only",
]) {
  assert.ok(audit.includes(safeOption), `${safeOption} must remain an allowed recommendation`);
}

assert.match(audit, /This audit recommends hiding AS-01 through AS-05/);
assert.match(audit, /It does not implement that recommendation/);
assert.match(audit, /Natal Moon[\s\S]*Birth-chart Moon data, not current-sky transit data/);
assert.match(audit, /Dice[\s\S]*Preserve untouched/);
assert.doesNotMatch(
  audit,
  /supabase (?:db push|functions deploy)|wrangler deploy|curl |fetch\(|process\.env|service_role\s*[:=]|sb_secret_/i
);

console.log("reachable astrology scope audit contract passed");
