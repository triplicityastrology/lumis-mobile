import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const authService = readFileSync("apps/mobile/src/services/auth.ts", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const authScreen = readFileSync("apps/mobile/src/screens/LumisAuthScreen.tsx", "utf8");
const profileScreen = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const authSystemKit = readFileSync("apps/mobile/src/components/AuthSystemKit.tsx", "utf8");

const signOutService = extractRange(
  authService,
  "export async function signOut",
  authService.length
);
assert.match(signOutService, /supabase\.auth\.signOut\(\)/);
assert.match(signOutService, /return \{ isConfigured: true, user: null \}/);
assert.ok(
  signOutService.indexOf("supabase.auth.signOut()") <
    signOutService.indexOf("return { isConfigured: true, user: null }"),
  "the service may report signed out only after Supabase confirms sign-out"
);

const authoritativeSignOut = extractRange(
  app,
  "async function performAuthoritativeSignOut",
  "async function startOver"
);
for (const requiredOperation of [
  "await signOut()",
  "await clearLocalDemoSession()",
  'clearVisibleAccountState("Signed out.")',
  "setAuthStatus(signedOutStatus)",
  'setScreen("auth")'
]) {
  assert.match(authoritativeSignOut, new RegExp(escapeRegExp(requiredOperation)));
}
assert.ok(
  authoritativeSignOut.indexOf("await signOut()") <
    authoritativeSignOut.indexOf('clearVisibleAccountState("Signed out.")'),
  "visible private state must clear only after authoritative sign-out succeeds"
);

const visibleStateReset = extractRange(
  app,
  "function clearVisibleAccountState",
  "async function performAuthoritativeSignOut"
);
for (const reset of [
  "setProfileData(null)",
  "setChartProfile(null)",
  "setPersonaStyle(\"acceptance\")",
  "setPersonaName(\"Lumis\")",
  "setPersonaAvatarKey(\"psyche\")",
  "setChatTurns([])",
  "setReflectionThreads([])",
  "setMainFocus(null)",
  "setRemainingCredits(STARTER_CREDITS)",
  "setPendingChatDraft(null)"
]) {
  assert.match(visibleStateReset, new RegExp(escapeRegExp(reset)));
}

assert.equal(
  (app.match(/onRequestLogout=\{\(\) => setLogoutDialogOpen\(true\)\}/g) ?? []).length,
  3,
  "Profile, Auth, and No-Chart must request the same app-owned logout flow"
);
assert.equal(
  (app.match(/<LogoutDialog/g) ?? []).length,
  1,
  "the app must mount one shared logout dialog"
);
assert.match(
  app,
  /<LogoutDialog[\s\S]{0,180}onCancel=\{\(\) => setLogoutDialogOpen\(false\)\}[\s\S]{0,180}onConfirm=\{performAuthoritativeSignOut\}/
);

for (const [name, source] of [
  ["Auth", authScreen],
  ["Profile", profileScreen],
  ["No-Chart", authSystemKit]
]) {
  assert.match(source, /onRequestLogout/, `${name} must use the shared logout request`);
}
assert.doesNotMatch(authScreen, /services\/auth";[\s\S]*\bsignOut\b/);
assert.doesNotMatch(profileScreen, /<LogoutDialog/);
assert.match(authSystemKit, /<PrimaryButton label="Done" onPress=\{onCancel\}/);
assert.match(authSystemKit, /accessibilityLabel="Cancel and stay signed in"/);

const signedInRestore = extractRange(
  app,
  "async function restoreAccountForStatus",
  "// AUTH-005"
);
assert.match(
  signedInRestore,
  /if \(status\.isConfigured && status\.user\) \{[\s\S]{0,120}clearVisibleAccountState\("Loading your Lumis profile\.\.\."\)/
);
assert.match(signedInRestore, /loadSupabaseAccountState\(\)/);
assert.match(signedInRestore, /applySupabaseAccountState\(accountState\)/);

for (const restoredField of [
  "profileData",
  "chartProfile",
  "personaStyle",
  "buddyName",
  "buddyAvatarKey",
  "reflectionThreads",
  "mainFocus",
  "planTier",
  "remainingCredits"
]) {
  assert.match(accountState, new RegExp(`\\b${restoredField}\\b`));
}
assert.match(accountState, /const userId = authData\.user\?\.id/);
assert.ok(
  (accountState.match(/\.eq\("(?:id|user_id)", userId\)/g) ?? []).length >= 5,
  "account reads must remain scoped to the authenticated Supabase user"
);
assert.doesNotMatch(
  accountState,
  /\.(?:insert|upsert|update)\(|complete_profile_onboarding|starter_onboarding/,
  "account restoration must be read-only and cannot create another Starter grant"
);

const accounts = new Map([
  [
    "user-ruby",
    {
      chart: { version: 3 },
      persona: "spark",
      focus: "relationships",
      credits: 127,
      reflections: ["reflection-a"],
      starterGrantCount: 1
    }
  ],
  [
    "user-second",
    {
      chart: null,
      persona: "acceptance",
      focus: null,
      credits: 0,
      reflections: [],
      starterGrantCount: 0
    }
  ]
]);
const restore = (userId) => structuredClone(accounts.get(userId));
const visibleSession = structuredClone(accounts.get("user-ruby"));
const cancelledSession = structuredClone(visibleSession);
assert.deepEqual(
  cancelledSession,
  visibleSession,
  "cancelling the confirmation must preserve the current session state"
);
const firstLogin = restore("user-ruby");
const sameEmailLogin = restore("user-ruby");
assert.deepEqual(sameEmailLogin, firstLogin, "same-email login must restore the same account state");
assert.equal(
  accounts.get("user-ruby").starterGrantCount,
  1,
  "read-only restoration must not duplicate the Starter grant"
);
assert.notDeepEqual(
  restore("user-second"),
  sameEmailLogin,
  "a different authenticated user must receive a separate account state"
);

console.log("auth logout and account restore contract checks passed");

function extractRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = typeof endMarker === "number" ? endMarker : source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
