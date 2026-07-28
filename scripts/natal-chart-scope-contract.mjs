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
  const exclusion = source.indexOf("solar return|solar_return");
  const timing = source.indexOf("transit|timing|this month");
  assert.ok(exclusion >= 0 && timing > exclusion, `${name} must reject Solar Return before timing routing`);
}

assert.match(
  chatRouter,
  /name: "solar return excluded"[\s\S]{0,180}expectedRoute: "out_of_scope"/
);
assert.doesNotMatch(routes, /solar return/i);
assert.doesNotMatch(entitlements, /solar return/i);
assert.doesNotMatch(localChat, /solar return/i);

console.log("natal-only chart, storage, client, and AI-context scope checks passed");
