import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const accountState = await readFile("apps/mobile/src/services/accountState.ts", "utf8");
const app = await readFile("apps/mobile/App.tsx", "utf8");
const profileFunction = await readFile("supabase/functions/profile/index.ts", "utf8");
const hostedProof = await readFile("scripts/staging-backend-smoke.mjs", "utf8");
const secureRunner = await readFile("scripts/run-staging-backend-test.sh", "utf8");

assert.match(
  accountState,
  /export async function loadSupabaseAccountState\(\s*authenticatedUserId\?: string/
);
assert.match(accountState, /let userId = authenticatedUserId/);
for (const table of ["users", "birth_data", "ai_profiles", "monthly_balance", "chat_threads"]) {
  assert.match(
    accountState,
    new RegExp(`\\.from\\("${table}"\\)[\\s\\S]{0,260}\\.eq\\("(?:id|user_id)", userId\\)`),
    `${table} restoration must be scoped to the authenticated user`
  );
}
assert.match(
  accountState,
  /if \(!birthData && !profile\) \{\s*return emptyAccountState/,
  "only a confirmed absence of both chart records may enter onboarding"
);
assert.match(
  accountState,
  /if \(requiredError\) \{\s*throw new AccountRestoreError\(\s*"ACCOUNT_DATA_UNAVAILABLE"/,
  "a required chart query failure cannot become an empty account"
);
assert.match(
  accountState,
  /const requiredError = userResult\.error \?\? birthResult\.error \?\? profileResult\.error/,
  "only user, birth, and active-profile reads may block authoritative chart restoration"
);
assert.match(
  accountState,
  /reflectionHistoryStatus: reflectionHistoryUnavailable \? "unavailable" : "loaded"/,
  "recoverable history failure must be represented without erasing the chart account"
);
assert.match(accountState, /threadsResult\.error \? \[\]/);
assert.doesNotMatch(accountState, /const firstError/);
assert.match(
  accountState,
  /birthData\.active_chart_version !== profile\.chart_version/,
  "restoration must reject mismatched active chart versions"
);
for (const restoredField of [
  "profileData:",
  "chartProfile:",
  "personaStyle,",
  "buddyName:",
  "buddyAvatarKey:",
  "reflectionThreads,",
  "mainFocus:"
]) {
  assert.match(accountState, new RegExp(restoredField));
}

const signedInRestore = extractRange(
  app,
  "async function restoreAccountForStatus",
  "async function applyRefreshedAuthStatus"
);
assert.match(signedInRestore, /if \(status\.isConfigured && status\.user\)/);
assert.match(signedInRestore, /loadSupabaseAccountState\(status\.user\.id\)/);
assert.match(signedInRestore, /routeAfterSplash\("restoringSpace"\)/);
assert.match(signedInRestore, /else if \(!restored && routeLoadedAccount\)/);
assert.ok(
  signedInRestore.indexOf("return;") < signedInRestore.indexOf("loadLocalDemoSession()"),
  "a signed-in restore failure cannot fall through to local fixture/session state"
);

assert.match(profileFunction, /PROFILE_ALREADY_EXISTS/);
assert.match(hostedProof, /Repeat onboarding is rejected before chart generation/);
assert.match(hostedProof, /Same-email sign-in can reload the saved profile and Past Reflections/);
assert.match(hostedProof, /RLS and grants block cross-user chart data/);
assert.match(secureRunner, /project_ref.*bmqhwofmdgebpcihjlnb/);
assert.match(secureRunner, /read -r -s secret_key/);
assert.doesNotMatch(secureRunner, /echo ["']?\$secret_key/);
assert.doesNotMatch(hostedProof, /console\.log\([^)]*(?:email|birth_date|access_token)/i);

console.log("account restoration evidence contract checks passed");

function extractRange(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}
