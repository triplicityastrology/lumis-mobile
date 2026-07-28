import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  accountState,
  chartSanitizer,
  chatFunction,
  chatRouter,
  entitlements,
  localChat,
  localDemoSession,
  profileFunction,
  routes,
  worker
] = await Promise.all([
  readFile("apps/mobile/src/services/accountState.ts", "utf8"),
  readFile("packages/astrology/src/chart-sanitizer.ts", "utf8"),
  readFile("supabase/functions/chat-message/index.ts", "utf8"),
  readFile("packages/shared/src/config/chat-router.ts", "utf8"),
  readFile("packages/shared/src/config/entitlements.ts", "utf8"),
  readFile("apps/mobile/src/services/chat.ts", "utf8"),
  readFile("apps/mobile/src/services/localDemoSession.ts", "utf8"),
  readFile("supabase/functions/profile/index.ts", "utf8"),
  readFile("packages/shared/src/config/routes.ts", "utf8"),
  readFile("workers/chart-mobile/worker.js", "utf8")
]);

assert.match(
  chartSanitizer,
  /const natalChart: ChartV2 = \{[\s\S]*?version: "chart_v2"[\s\S]*?planets,[\s\S]*?houses,[\s\S]*?angles:/,
  "client/storage sanitizer must rebuild the exact natal chart contract"
);
assert.doesNotMatch(
  chartSanitizer,
  /chartWithoutRawProvider|return chart\b|return \{\s*\.\.\.chart\b/,
  "sanitizer cannot preserve unknown chart scopes through a permissive spread"
);
assert.match(
  accountState,
  /chartProfile: sanitizeChartForClient\(profile\.chart_json, birthData\.time_unknown\)/,
  "restored database charts must cross the natal-only client boundary"
);
assert.ok(
  (localDemoSession.match(/chartProfile: sanitizeChartForClient\(/g) ?? []).length === 2,
  "local chart storage must sanitize both saved and restored sessions"
);
assert.match(
  profileFunction,
  /chart: sanitizeChartForClient\(chart, input\.chartRequest\.birth_data\.time_unknown\)/,
  "live Worker output must be sanitized before onboarding or regeneration persistence"
);
assert.match(
  profileFunction,
  /p_chart_json: sanitizeChartForClient\(profile\.chart_json, birthData\.time_unknown\)/,
  "legacy repair must sanitize the saved chart before copying it"
);
assert.match(worker, /calculation_version !== "mobile_natal_v1"/);
assert.match(worker, /body\.audit\?\.chart_type !== "natal"/);
assert.match(worker, /url\.pathname === "\/mobile\/natal-chart"/);

for (const [name, source] of [
  ["shared router", chatRouter],
  ["Edge chat router", chatFunction]
]) {
  assert.doesNotMatch(
    source,
    /Solar Return is temporarily unavailable|timing analysis/i,
    `${name} cannot describe Solar Return as temporary or offer a timing reading`
  );
}

assert.match(
  chatRouter,
  /export function isSolarReturnRequest[\s\S]*solar\[\\s_-\]\*return[\s\S]*annual theme[\s\S]*年度主題/
);
assert.match(
  chatRouter,
  /\\bsr\\b[\s\S]*interpret\|reading\|read\|chart\|astrolog\|meaning\|theme/,
  "standalone SR must require chart or interpretation context"
);
for (const fixtureName of [
  "solar return abbreviated interpretation excluded",
  "solar return full name excluded",
  "annual theme excluded",
  "traditional Chinese solar return excluded",
  "traditional Chinese annual theme excluded"
]) {
  const fixtureStart = chatRouter.indexOf(`name: "${fixtureName}"`);
  assert.ok(
    fixtureStart >= 0 &&
      chatRouter.slice(fixtureStart, fixtureStart + 180).includes('expectedRoute: "out_of_scope"'),
    `${fixtureName} must be covered by the shared route fixtures`
  );
}
assert.match(
  chatRouter,
  /name: "ordinary honorific sr is not solar return"[\s\S]{0,180}expectedRoute: "casual"/,
  "ordinary uses of Sr. cannot be classified as Solar Return"
);
assert.match(
  chatFunction,
  /classifyChatRoute,[\s\S]*isSolarReturnRequest[\s\S]*packages\/shared\/src\/config\/chat-router\.ts/,
  "the Edge chat route must use the shared Solar Return classifier"
);
for (const [name, source] of [
  ["Edge chat", chatFunction],
  ["local chat", localChat]
]) {
  assert.match(
    source,
    /if \(solarReturnRequest\) \{\s*return "Solar Return is not part of Lumis\.";/,
    `${name} must use the approved Solar Return product boundary`
  );
}
assert.doesNotMatch(
  `${chatFunction}\n${localChat}`,
  /Solar Return is temporarily unavailable|timing analysis/i,
  "Solar Return handling cannot describe the feature as temporary or offer timing analysis"
);
assert.doesNotMatch(routes, /solar return/i);
assert.doesNotMatch(entitlements, /solar return/i);

console.log("natal-only chart, storage, client, and AI-context scope checks passed");
