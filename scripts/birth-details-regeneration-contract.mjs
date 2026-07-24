import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const migration = readFileSync("supabase/migrations/0026_birth_details_regeneration.sql", "utf8");
const profile = readFileSync("supabase/functions/profile/index.ts", "utf8");
const mobileProfile = readFileSync("apps/mobile/src/services/profile.ts", "utf8");
const mobileApp = readFileSync("apps/mobile/App.tsx", "utf8");
const birthDetailsScreen = readFileSync("apps/mobile/src/features/birthDetails/BirthDetailsChangeScreen.tsx", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");

const diagnostics = ts.transpileModule(profile, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
  fileName: "profile.ts",
  reportDiagnostics: true
}).diagnostics ?? [];

assert.deepEqual(
  diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
  [],
  "profile Edge Function contains a TypeScript syntax error"
);

assert.match(profile, /pathname\.endsWith\("\/birth-details\/change"\)/);
assert.match(profile, /flow:\s*"birth_details_regeneration"/);
assert.match(profile, /resolve_trusted_birth_location/);
assert.match(profile, /isValidBirthDate\(body\.birth_date, new Date\(\), trustedLocation\.tz_str\)/);
assert.match(profile, /reserve_birth_details_change[\s\S]*generateChart/);
assert.ok(
  profile.indexOf("reserve_birth_details_change") < profile.lastIndexOf("chartResult = await generateChart"),
  "reservation must happen before the paid chart call"
);
assert.match(profile, /fail_birth_details_change/);
assert.match(profile, /complete_birth_details_change/);
assert.match(profile, /successful_change_count:\s*completion\.successful_change_count/);
assert.match(profile, /remaining_changes:\s*completion\.remaining_changes/);
assert.match(profile, /validateBirthChangeRequest\(rawBody\)/);
assert.match(profile, /typeof timeUnknown !== "boolean"/);
assert.match(profile, /isStrictBirthTime\(birthTime\)/);
assert.match(profile, /reservation\.duplicate[\s\S]*loadAuthoritativeBirthChangeState/);
assert.ok(
  profile.indexOf("reservation.duplicate") < profile.indexOf("consumeProfileRateLimit", profile.indexOf("reservation.duplicate")),
  "committed idempotent retries must be resolved before rate limiting"
);
assert.match(profile, /workerRequestId:\s*reservation\.worker_request_id \?\? clientRequestId/);
assert.match(profile, /requestedAt:\s*reservation\.worker_requested_at/);
assert.match(mobileProfile, /\/functions\/v1\/profile\/birth-details\/change/);
assert.match(mobileProfile, /regenerateBirthDetails\([\s\S]*clientRequestId:\s*string/);
assert.match(mobileProfile, /client_request_id:\s*clientRequestId/);
assert.doesNotMatch(mobileProfile, /client_request_id:\s*randomUUID\(\)/);
assert.match(mobileProfile, /class BirthDetailsChangeError extends Error/);
assert.match(mobileProfile, /Authorization:\s*`Bearer \$\{accessToken\}`/);
const mobileRegeneration = mobileProfile.slice(
  mobileProfile.indexOf("export async function regenerateBirthDetails"),
  mobileProfile.indexOf("function isEdgeFunctionTransportError")
);
assert.doesNotMatch(mobileRegeneration, /buildFixtureChart/);
assert.match(mobileRegeneration, /PROFILE_CONFIGURATION_REQUIRED/);
assert.match(mobileRegeneration, /PROFILE_AUTH_REQUIRED/);
assert.doesNotMatch(
  mobileRegeneration,
  /throw new Error\("Sign in to change saved birth details\."\)/,
  "mobile must preserve truthful auth/configuration failure codes"
);
assert.match(mobileApp, /regenerateBirthDetails\(updated, clientRequestId\)/);
assert.match(mobileApp, /setBirthDetailChanges\(result\.successful_change_count\)/);
assert.match(mobileApp, /loadSupabaseAccountState\(\)[\s\S]*setChatTurns\(\[\]\)[\s\S]*setActiveSupabaseThreadId\(null\)[\s\S]*setForceNewSupabaseThread\(true\)/);
assert.match(mobileApp, /error\.code === "49001"/);
assert.match(birthDetailsScreen, /requestIdRef\.current \?\? randomUUID\(\)/);
assert.match(birthDetailsScreen, /onRegenerate\(draft, clientRequestId\)/);
assert.match(birthDetailsScreen, /outcome\.code === "49002"[\s\S]*setStep\("edit"\)/);
assert.match(birthDetailsScreen, /outcome\.code === "49001"[\s\S]*setStep\("display"\)/);
assert.match(birthDetailsScreen, /setFailureMessage\(outcome\.message\)[\s\S]*setStep\("failure"\)/);
assert.match(birthDetailsScreen, /sub=\{failureMessage \?\?/);
assert.match(birthDetailsScreen, /ASC, MC, houses, or planet-house placements/);
assert.equal(
  (mobileApp.match(/<CelestialBackground(?:\s[^>]*)?\/>/g) ?? []).length,
  1,
  "App must mount one shared CelestialBackground"
);
assert.equal(
  (birthDetailsScreen.match(/<CelestialBackground(?:\s[^>]*)?\/>/g) ?? []).length,
  0,
  "BirthDetailsChangeScreen must reuse the shared root background"
);
assert.match(birthDetailsScreen, /step !== "regenerating" \? \(/);
assert.match(accountState, /active_chart_version, successful_change_count/);
assert.match(accountState, /successfulBirthDetailChanges:\s*birthData\.successful_change_count/);
assert.match(mobileApp, /setBirthDetailChanges\(accountState\.successfulBirthDetailChanges\)/);
const normalBirthDetailsPath = mobileApp.slice(
  mobileApp.indexOf('if (screen === "birthDetails")'),
  mobileApp.indexOf('if (screen === "chartUpdated"')
);
assert.ok(normalBirthDetailsPath.length > 0, "normal birth-details route was not found");
assert.match(normalBirthDetailsPath, /regenerateBirthDetails\(updated, clientRequestId\)/);
assert.match(normalBirthDetailsPath, /code:\s*"AUTH_REQUIRED"/);
assert.doesNotMatch(
  normalBirthDetailsPath,
  /submitChartProfile|buildFixtureChart/,
  "normal birth-details changes must never reuse onboarding or fixture generation"
);
assert.doesNotMatch(
  normalBirthDetailsPath,
  /setBirthDetailChanges\(\s*\(?(?:count|current|value)|Math\.min\([^)]*\+\s*1|successfulChanges\s*\+\s*1/,
  "mobile must not increment the PROF-2 lifetime counter"
);
const birthChangeHandler = profile.slice(
  profile.indexOf("async function handleBirthDetailsChange"),
  profile.indexOf("function validateBirthChangeRequest")
);
assert.match(birthChangeHandler, /requireLiveWorker:\s*true/);
assert.doesNotMatch(
  birthChangeHandler,
  /error:\s*error instanceof Error \? error\.message/,
  "PROF-2 logs must not emit arbitrary provider or transport error messages"
);
const chartGeneration = profile.slice(
  profile.indexOf("async function generateChart"),
  profile.indexOf("function allowsFixtureFallback")
);
assert.match(chartGeneration, /input\.requireLiveWorker \|\| !allowsFixtureFallback\(\)/);

assert.match(migration, /create table if not exists public\.birth_detail_change_requests/i);
assert.match(migration, /where status = 'processing'/i);
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('birth-details-change:'/i);
assert.match(migration, /lease_expires_at timestamptz[\s\S]*interval '5 minutes'/i);
assert.match(migration, /successful_change_count >= 3[\s\S]*'49001'/i);
assert.match(migration, /'49002'/i);
assert.match(migration, /'49003'/i);
assert.match(migration, /v_new_change_count := v_birth\.successful_change_count \+ 1/i);

const completionStart = migration.indexOf("create or replace function public.complete_birth_details_change");
const completionEnd = migration.indexOf("revoke all on function public.reserve_birth_details_change");
const completion = migration.slice(completionStart, completionEnd);
assert.ok(completionStart >= 0 && completionEnd > completionStart);
assert.match(completion, /update public\.birth_data_history[\s\S]*status = 'superseded'/i);
assert.match(completion, /update public\.ai_profiles[\s\S]*is_active = false/i);
assert.match(completion, /insert into public\.birth_data_history/i);
assert.match(completion, /insert into public\.ai_profiles/i);
assert.match(completion, /'status', 'chart_context_regenerated'[\s\S]*'flow', 'PROF-2'/i);
assert.doesNotMatch(completion, /v_previous_profile\.profile_json/i);
assert.match(completion, /p_chart_json - 'rawProviderResponse'/i);
assert.doesNotMatch(completion, /update public\.chat_threads/i);

const reserveStart = migration.indexOf("create or replace function public.reserve_birth_details_change");
const failStart = migration.indexOf("create or replace function public.fail_birth_details_change");
const reserve = migration.slice(reserveStart, failStart);
assert.doesNotMatch(reserve, /successful_change_count\s*=|successful_change_count\s*\+/i);
assert.match(reserve, /status = 'committed'[\s\S]*'duplicate', true/i);
assert.match(reserve, /request_digest <> p_request_digest[\s\S]*'49002'/i);
assert.match(migration, /worker_request_id uuid not null/i);
assert.match(migration, /worker_requested_at timestamptz not null/i);
assert.match(reserve, /'resumed', true/i);
assert.match(reserve, /lease_expires_at = now\(\) \+ interval '5 minutes'/i);
assert.match(reserve, /error_code in \('CHART_WORKER_FAILED', 'PROFILE_COMMIT_FAILED', 'LEASE_EXPIRED', '49003'\)/i);

assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all on table public\.birth_detail_change_requests from public, anon, authenticated/i);
assert.match(migration, /grant execute on function public\.complete_birth_details_change[\s\S]*to service_role/i);
assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated/i);

console.log("birth-details regeneration contract checks passed");
