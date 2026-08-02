import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const accountState = await readFile("apps/mobile/src/services/accountState.ts", "utf8");
const app = await readFile("apps/mobile/App.tsx", "utf8");
const authService = await readFile("apps/mobile/src/services/auth.ts", "utf8");
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
  /if \(requiredError\) \{\s*throw new AccountRestoreError\(\s*isTransientRequiredReadError\(requiredError\)[\s\S]{0,120}"ACCOUNT_DATA_UNAVAILABLE"/,
  "a required chart query failure cannot become an empty account"
);
assert.match(
  accountState,
  /const requiredError = userResult\.error \?\? birthResult\.error \?\? profileResult\.error/,
  "only user, birth, and active-profile reads may block authoritative chart restoration"
);
assert.match(
  accountState,
  /\.select\("display_name, focus, persona_style, buddy_name, buddy_avatar_key"\)/,
  "required chart restoration must remain compatible before language migration 0035"
);
assert.match(
  accountState,
  /const languagePreference = !languageResult \|\| languageResult\.error\s*\? null/,
  "optional language preference failure cannot erase a valid chart account"
);
assert.match(accountState, /settleOptionalQuery\([\s\S]*select\("lang, language_preference_set_at"\)/);
assert.match(
  accountState,
  /async function settleOptionalQuery<T>[\s\S]*catch \{[\s\S]*return null/,
  "optional future schema requests must fail independently of required chart reads"
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
assert.match(signedInRestore, /loadStartupAccountState\(status\.user\.id\)/);
assert.match(signedInRestore, /routeAfterSplash\("restoringSpace"\)/);
assert.match(signedInRestore, /else if \(!restored && routeLoadedAccount\)/);
assert.ok(
  signedInRestore.indexOf("return;") < signedInRestore.indexOf("loadLocalDemoSession()"),
  "a signed-in restore failure cannot fall through to local fixture/session state"
);
const startupRestorePolicy = readFileSync(
  "apps/mobile/src/services/startupRestorePolicy.ts",
  "utf8"
);
assert.match(startupRestorePolicy, /STARTUP_RESTORE_MAX_RETRIES = 3/);
assert.match(
  startupRestorePolicy,
  /STARTUP_RESTORE_RETRY_DELAY_MS \* \(retryCount \+ 1\)/,
  "transient startup recovery must use a bounded backoff inside the splash window"
);
assert.match(
  app,
  /async function loadStartupAccountState[\s\S]*shouldRetryStartupAccountError\(error, retryCount\)[\s\S]*startupRetryDelay\(retryCount - 1\)/,
  "cold-start recovery must retry only explicit transient failures and remain bounded"
);
assert.match(
  app,
  /async function restoreExistingAuthSession[\s\S]{0,260}loadStartupAuthStatus\(\)[\s\S]{0,180}restoreAccountForStatus\(status, true, true\)/,
  "initial persisted-session restoration must validate and retry only transient startup failures"
);
assert.match(
  app,
  /async function restoreExistingAuthSession[\s\S]*?catch \(error\)[\s\S]*?setRestoreResult\("failed"\)[\s\S]*?routeAfterSplash\("restoringSpace"\)/,
  "exhausted session hydration cannot be presented as a signed-out account"
);
assert.match(
  app,
  /async function applyRefreshedAuthStatus[\s\S]{0,300}routeAfterSplash\("restoringSpace"\)[\s\S]{0,180}restoreAccountForStatus\(status, true, true\)/,
  "post-callback restoration must remain loading through the bounded account-read retry"
);
assert.match(
  authService,
  /getSession\(\)[\s\S]{0,500}if \(!sessionData\.session\)[\s\S]{0,220}getUser\(\)/,
  "startup must hydrate persisted Supabase state before authoritative user validation"
);
assert.match(
  app,
  /function openAccountRecovery\(\)[\s\S]{0,300}setScreen\("auth"\)/,
  "a failed restore must expose signed-in account and logout controls"
);
assert.match(app, /onBack=\{openAccountRecovery\}/);

assert.match(profileFunction, /PROFILE_ALREADY_EXISTS/);
assert.match(hostedProof, /Repeat onboarding is rejected before chart generation/);
assert.match(hostedProof, /Same-email sign-in can reload the saved profile and Past Reflections/);
assert.match(hostedProof, /RLS and grants block cross-user chart data/);
assert.match(secureRunner, /project_ref.*bmqhwofmdgebpcihjlnb/);
assert.match(secureRunner, /read -r -s secret_key/);
assert.doesNotMatch(secureRunner, /echo ["']?\$secret_key/);
assert.doesNotMatch(hostedProof, /console\.log\([^)]*(?:email|birth_date|access_token)/i);

// AUTH-005 restoration origin: only a deliberate "reload" shows the restored-
// account confirmation card; the failure Retry ("retry") continues directly to
// Chat (like automatic cold-start restoration), never the card.
assert.match(app, /async function restoreSpace\(origin: "reload" \| "retry" = "reload"\)/);
assert.match(app, /if \(origin === "retry"\) \{[\s\S]{0,160}setScreen\("chat"\)/);
assert.match(app, /Deliberate reload[\s\S]{0,140}setRestoreResult\("foundChart"\)/);
assert.match(app, /onRetry=\{\(\) => restoreSpace\("retry"\)\}/);
assert.match(app, /onReload=\{\(\) => restoreSpace\("reload"\)\}/);

console.log("account restoration evidence contract checks passed");

function extractRange(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}
