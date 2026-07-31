import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const lifecycle = readFileSync("packages/astrology/src/natal-chart-lifecycle.ts", "utf8");
const profile = readFileSync("supabase/functions/profile/index.ts", "utf8");
const profileService = readFileSync("apps/mobile/src/services/profile.ts", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const summary = readFileSync("apps/mobile/src/services/natalChartSummary.ts", "utf8");
const insights = readFileSync("apps/mobile/src/screens/ChartInsightsScreen.tsx", "utf8");

assert.match(lifecycle, /adaptProviderNeutralNatalPayload/);
assert.match(lifecycle, /composeNatalEngineOutput/);
assert.match(lifecycle, /projectSafeNatalContext/);
assert.match(lifecycle, /non_authoritative_recomputed_projection/);
assert.match(lifecycle, /recompute_from_immutable_chart_snapshot/);
assert.match(lifecycle, /NATAL_LIFECYCLE_ABSOLUTE_LONGITUDE_REQUIRED/);
assert.match(lifecycle, /NATAL_LIFECYCLE_OUT_OF_SCOPE/);
assert.match(lifecycle, /precision === "no_birth_time" && key === "moon"/);
assert.match(lifecycle, /south_node_must_match_north_node_opposition/);
assert.doesNotMatch(lifecycle, /\bfetch\(|from ["'][^"']*(?:chat|dice|knowledge)/i);

assert.match(profile, /attachNatalChartProjection\([\s\S]*chart,[\s\S]*time_unknown/);
assert.match(profile, /if \(!projectedChart\.ok\)[\s\S]*throw new Error\(projectedChart\.error\.code\)/);
assert.ok(profile.indexOf("attachNatalChartProjection") < profile.indexOf("p_chart_json: chart"));
assert.match(profile, /complete_profile_onboarding/);
assert.match(profile, /complete_birth_details_change/);
assert.match(profile, /requireLiveWorker:\s*true/);
assert.match(profileService, /supabase\.functions\.invoke\("profile"/);
assert.match(profileService, /if \(!response\?\.chart\)[\s\S]*could not safely confirm the saved chart/);
assert.match(profileService, /mode:\s*"supabase"/);
assert.match(app, /const result = await submitChartProfile\(profileData\)/);
assert.match(app, /result\.mode === "supabase"[\s\S]*setAccountSource\("supabase"\)/);
assert.match(app, /regenerateBirthDetails\(updated, clientRequestId\)[\s\S]*loadSupabaseAccountState\(authStatus\.user\.id\)/);
assert.match(accountState, /birthData\.active_chart_version !== profile\.chart_version/);
assert.match(accountState, /sanitizeChartForClient\(profile\.chart_json, birthData\.time_unknown\)/);
assert.match(summary, /readNatalChartProjection/);
assert.match(summary, /MobileNatalChartSummary \| null/);
assert.doesNotMatch(summary, /email|birthDate|birth_time|coordinates|userId|accountId/);
assert.match(insights, /buildMobileNatalChartSummary\(chart\)/);
assert.match(insights, /Validated natal structure/);
assert.match(insights, /NatalWheel chart=\{displayedChart\}/);
assert.match(insights, /structuralSummary\?\.precision === "full" \? chart\.houses : \[\]/);

const onboardingGenerate = profile.indexOf("chartResult = await generateChart");
const regenerationGenerate = profile.lastIndexOf("chartResult = await generateChart");
const onboardingPersist = profile.indexOf("p_chart_json: chart");
const regenerationPersist = profile.lastIndexOf("p_chart_json: chart");
assert.ok(
  onboardingGenerate >= 0 && onboardingGenerate < onboardingPersist,
  "Onboarding must generate and validate the chart before persistence."
);
assert.ok(
  regenerationGenerate > onboardingGenerate && regenerationGenerate < regenerationPersist,
  "Regeneration must generate and validate the chart before persistence."
);
assert.doesNotMatch(
  summary,
  /buildFixtureChart|submitChartProfile|regenerateBirthDetails|functions\.invoke|\bfetch\(/,
  "Mobile structural summary must remain a pure restored-chart projection."
);

console.log("natal chart lifecycle integration source contract passed");
