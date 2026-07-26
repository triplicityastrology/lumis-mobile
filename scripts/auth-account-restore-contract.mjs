import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const authService = readFileSync("apps/mobile/src/services/auth.ts", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const authScreen = readFileSync("apps/mobile/src/screens/LumisAuthScreen.tsx", "utf8");
const profileScreen = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const authSystemKit = readFileSync("apps/mobile/src/components/AuthSystemKit.tsx", "utf8");
const supabaseService = readFileSync("apps/mobile/src/services/supabase.ts", "utf8");

assert.match(authService, /import \* as Linking from "expo-linking"/);
const emailRedirect = extractRange(
  authService,
  "export function getEmailRedirectTo",
  "function formatAuthErrorMessage"
);
assert.match(emailRedirect, /Linking\.createURL\("auth\/callback"\)/);
assert.match(emailRedirect, /Platform\.OS !== "web" && isLocalhostUrl\(redirectUrl\)/);
assert.doesNotMatch(
  emailRedirect,
  /globalThis\.location\.origin/,
  "mobile magic links must not use the browser localhost origin"
);

const redirectHandler = extractRange(
  authService,
  "export async function handleAuthRedirectFromUrl",
  "export async function sendMagicLink"
);
assert.match(redirectHandler, /url\?: string \| null/);
assert.match(redirectHandler, /new URL\(redirectUrl\)/);
assert.match(redirectHandler, /isLumisAuthCallback\(currentUrl\)/);
assert.match(redirectHandler, /exchangeCodeForSession\(authCode\)/);
assert.match(redirectHandler, /setSession\(\{[\s\S]*access_token: accessToken,[\s\S]*refresh_token: refreshToken/);
assert.equal(
  (redirectHandler.match(/exchangeNativeCredentialWithResumeRetry\(/g) ?? []).length,
  2,
  "both code exchange and token fallback must use the bounded native resume retry"
);
const codeExchangePath = extractRange(
  redirectHandler,
  "if (authCode) {",
  "const accessToken"
);
assert.match(
  codeExchangePath,
  /exchangeNativeCredentialWithResumeRetry\(\s*\(\) => supabase\.auth\.exchangeCodeForSession\(authCode\),\s*Platform\.OS !== "web"\s*\)/
);
const tokenExchangePath = extractRange(
  redirectHandler,
  "if (accessToken && refreshToken) {",
  "return { handled: false }"
);
assert.match(tokenExchangePath, /exchangeNativeCredentialWithResumeRetry/);
assert.match(tokenExchangePath, /supabase\.auth\.setSession/);
assert.match(redirectHandler, /successfulRedirect\(data\.session\.user\)/);
assert.match(redirectHandler, /formatRedirectExchangeError\(error\)/);
assert.doesNotMatch(
  redirectHandler,
  /console\.|setAuthStatus|setProfileData|starter_onboarding/,
  "redirect parsing must neither log private links nor create fake account state"
);

const successfulRedirect = extractRange(
  authService,
  "function successfulRedirect",
  "async function exchangeNativeCredentialWithResumeRetry"
);
assert.match(successfulRedirect, /status:\s*\{[\s\S]*isConfigured: true,[\s\S]*user/);
assert.doesNotMatch(
  successfulRedirect,
  /getAuthStatus|getUser|email|access_token|refresh_token/,
  "a successful exchange must return only the real session user without another network lookup"
);

const nativeResumeRetry = extractRange(
  authService,
  "async function exchangeNativeCredentialWithResumeRetry",
  "function formatRedirectError"
);
assert.match(nativeResumeRetry, /isNetworkFailure\(error\)/);
assert.match(nativeResumeRetry, /setTimeout\(resolve, 750\)/);
assert.equal(
  (nativeResumeRetry.match(/return (?:await )?exchange\(\)/g) ?? []).length,
  2,
  "native session establishment may retry one interrupted resume request exactly once"
);

const safeRedirectFailure = extractRange(
  authService,
  "function formatRedirectExchangeError",
  "function formatSessionNetworkError"
);
assert.match(safeRedirectFailure, /isNetworkFailure\(error\)/);
assert.match(safeRedirectFailure, /connection was interrupted/);
assert.doesNotMatch(
  safeRedirectFailure,
  /throw error|error\.message|console\./,
  "native exchange failures must not expose raw fetch or credential details"
);

assert.match(
  supabaseService,
  /import \{ createClient, processLock, type SupabaseClient \} from "@supabase\/supabase-js"/
);
assert.match(supabaseService, /lock: processLock/);

const authLinkLifecycle = extractRange(
  app,
  "useEffect(() => {\n    let isMounted = true;",
  "// Screens render as transparent foregrounds"
);
assert.match(authLinkLifecycle, /Linking\.getInitialURL\(\)/);
assert.match(authLinkLifecycle, /Linking\.addEventListener\("url", \(\{ url \}\) =>/);
assert.match(authLinkLifecycle, /handleAuthRedirectFromUrl\(url\)/);
assert.match(authLinkLifecycle, /authRedirectInFlightRef\.current/);
assert.match(authLinkLifecycle, /processedAuthRedirectUrlsRef\.current\.has\(url\)/);
assert.match(authLinkLifecycle, /processedAuthRedirectUrlsRef\.current\.add\(url\)/);
assert.match(authLinkLifecycle, /result\.status \?\? \(await getAuthStatus\(\)\)/);
assert.match(authLinkLifecycle, /await applyRefreshedAuthStatus\(status\)/);
assert.match(authLinkLifecycle, /subscription\.remove\(\)/);
const callbackLifecycle = extractRange(
  authLinkLifecycle,
  "async function restoreAfterAuthRedirect",
  "const subscription = Linking.addEventListener"
);
const redirectFailureCatch = extractRange(
  callbackLifecycle,
  "} catch (error) {",
  "} finally {"
);
assert.match(redirectFailureCatch, /setAuthError\(/);
assert.match(redirectFailureCatch, /setScreen\("auth"\)/);
assert.doesNotMatch(
  redirectFailureCatch,
  /applyRefreshedAuthStatus|getAuthStatus|console\./,
  "a failed exchange cannot restore or manufacture account state"
);
assert.doesNotMatch(
  authLinkLifecycle,
  /setAuthStatus\(\s*\{[\s\S]*user:/,
  "callback handling must restore only the session returned by Supabase"
);

assert.match(authScreen, /if \(authError\) \{\s*setSentToEmail\(null\)/);
assert.match(
  authScreen,
  /accessibilityRole="alert"[\s\S]*accessibilityLiveRegion="assertive"/
);

for (const mobileCallback of [
  "exp://192.0.2.10:8081/--/auth/callback",
  "lumis://auth/callback"
]) {
  assert.equal(isFixtureAuthCallback(mobileCallback), true);
  assert.equal(new URL(mobileCallback).hostname === "localhost", false);
}
assert.equal(isFixtureAuthCallback("http://localhost:8081"), false);
const invalidRedirectState = {
  authenticated: false,
  restored: false,
  error: ""
};
await simulateInvalidRedirect(invalidRedirectState);
assert.deepEqual(
  invalidRedirectState,
  {
    authenticated: false,
    restored: false,
    error: "That sign-in link is invalid or expired. Request a new secure link."
  },
  "an invalid callback must stay truthful and cannot manufacture an authenticated state"
);

const successfulExchangeState = {
  authenticated: false,
  restored: false,
  error: ""
};
await simulateCallbackExchange({
  state: successfulExchangeState,
  exchange: async () => ({
    isConfigured: true,
    user: { id: "fixture-user" }
  }),
  restore: async (status) => {
    assert.equal(status.user.id, "fixture-user");
    successfulExchangeState.restored = true;
  }
});
assert.deepEqual(successfulExchangeState, {
  authenticated: true,
  restored: true,
  error: ""
});

let codeResumeAttempts = 0;
const resumedCodeSession = await simulateNetworkResumeRetry(async () => {
  codeResumeAttempts += 1;
  if (codeResumeAttempts === 1) {
    throw new TypeError("Network request failed");
  }
  return { userId: "code-user" };
});
assert.equal(codeResumeAttempts, 2);
assert.equal(resumedCodeSession.userId, "code-user");

let tokenResumeAttempts = 0;
const resumedTokenSession = await simulateNetworkResumeRetry(async () => {
  tokenResumeAttempts += 1;
  if (tokenResumeAttempts === 1) {
    throw new TypeError("Network request failed");
  }
  return { userId: "token-user" };
});
assert.equal(tokenResumeAttempts, 2);
assert.equal(resumedTokenSession.userId, "token-user");

const failedExchangeState = {
  authenticated: false,
  restored: false,
  error: ""
};
let failedCodeAttempts = 0;
await simulateCallbackExchange({
  state: failedExchangeState,
  exchange: () =>
    simulateNetworkResumeRetry(async () => {
      failedCodeAttempts += 1;
      throw new TypeError("Network request failed");
    }),
  restore: async () => {
    failedExchangeState.restored = true;
  }
});
assert.equal(failedCodeAttempts, 2, "a failed code callback stops after one bounded retry");
assert.deepEqual(
  failedExchangeState,
  {
    authenticated: false,
    restored: false,
    error:
      "Lumis could not finish secure sign-in because the connection was interrupted. Check your connection and request a new sign-in link."
  },
  "a native fetch failure must remain signed out and show only the safe recovery message"
);

const processedCallbackUrls = new Set();
let duplicateCodeExchangeCount = 0;
const duplicateCallbackUrl = "lumis://auth/callback?code=redacted-fixture";
await simulateDeduplicatedCallback(
  duplicateCallbackUrl,
  processedCallbackUrls,
  async () => {
    duplicateCodeExchangeCount += 1;
  }
);
await simulateDeduplicatedCallback(
  duplicateCallbackUrl,
  processedCallbackUrls,
  async () => {
    duplicateCodeExchangeCount += 1;
  }
);
assert.equal(
  duplicateCodeExchangeCount,
  1,
  "cold-start and live URL delivery cannot re-exchange one callback"
);

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
    authoritativeSignOut.indexOf("await clearLocalDemoSession()"),
  "local session cleanup must happen only after authoritative sign-out succeeds"
);
assert.ok(
  authoritativeSignOut.indexOf("await clearLocalDemoSession()") <
    authoritativeSignOut.indexOf('clearVisibleAccountState("Signed out.")'),
  "visible private state must clear only after successful auth and local cleanup"
);

const failedSignOutState = {
  localSession: "preserved",
  visibleAccount: "preserved"
};
await assert.rejects(
  simulateAuthoritativeSignOut({
    state: failedSignOutState,
    signOutImpl: async () => {
      throw new Error("Supabase sign-out failed");
    }
  }),
  /Supabase sign-out failed/
);
assert.deepEqual(
  failedSignOutState,
  {
    localSession: "preserved",
    visibleAccount: "preserved"
  },
  "failed authoritative sign-out must preserve local and visible account state"
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
  (app.match(/onRequestLogout=\{requestAuthoritativeLogout\}/g) ?? []).length,
  3,
  "Profile, Auth, and No-Chart must request the same app-owned logout flow"
);
const logoutRequester = extractRange(
  app,
  "function requestAuthoritativeLogout",
  "function clearVisibleAccountState"
);
assert.match(logoutRequester, /setLogoutDialogOpen\(true\)/);
assert.doesNotMatch(
  logoutRequester,
  /signOut|clearVisibleAccountState|clearLocalDemoSession|setScreen/,
  "requesting logout may only open the shared confirmation dialog"
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
const profileRoute = extractRange(
  app,
  'if (screen === "profileTab" && profileData)',
  'if (screen === "birthDetails")'
);
assert.match(profileRoute, /<LumisProfileScreen/);
assert.match(
  profileRoute,
  /email=\{authStatus\?\.isConfigured \? authStatus\.user\?\.email : undefined\}/
);
assert.match(profileRoute, /onRequestLogout=\{requestAuthoritativeLogout\}/);
assert.match(app, /onAccountStatusRefreshed=\{applyRefreshedAuthStatus\}/);
const refreshedAuthStatus = extractRange(
  app,
  "async function applyRefreshedAuthStatus",
  "// AUTH-005"
);
assert.match(refreshedAuthStatus, /setAuthStatus\(status\)/);
assert.match(refreshedAuthStatus, /await restoreAccountForStatus\(status, true\)/);
assert.ok(
  refreshedAuthStatus.indexOf("setAuthStatus(status)") <
    refreshedAuthStatus.indexOf("await restoreAccountForStatus(status, true)"),
  "a refreshed real session must be visible before its account route is restored"
);
assert.match(
  profileScreen,
  /\{email && onRequestLogout \? \([\s\S]{0,260}onPress=\{onRequestLogout\}[\s\S]{0,220}>Log out</,
  "a real signed-in Profile must expose the shared Log out action"
);
assert.match(
  profileScreen,
  /\{email \? "Manage sign-in" : "Save this profile"\}/,
  "local demo profiles must remain visibly unsigned"
);
assert.equal(
  resolveProfileAuthPresentation({
    isConfigured: true,
    user: { email: "account-a@example.test" }
  }).showLogout,
  true,
  "a configured Supabase user must see Profile logout"
);
assert.deepEqual(
  resolveProfileAuthPresentation({ isConfigured: false, user: null }),
  { email: undefined, accountLabel: "Save this profile", showLogout: false },
  "a local demo must not expose a signed-in email or fake logout"
);
assert.match(authSystemKit, /<PrimaryButton label="Done" onPress=\{onCancel\}/);
assert.match(authSystemKit, /accessibilityLabel="Cancel and stay signed in"/);

const magicLinkSentScreen = extractRange(
  authSystemKit,
  "export function MagicLinkSentScreen",
  "// ---- AUTH-003"
);
assert.match(magicLinkSentScreen, /await onResend\(\)/);
assert.ok(
  magicLinkSentScreen.indexOf("await onResend()") <
    magicLinkSentScreen.indexOf('setResendState("success")'),
  "resend success may be shown only after the request resolves"
);
assert.match(magicLinkSentScreen, /catch \(caught\)/);
assert.match(magicLinkSentScreen, /setResendError\(/);
assert.match(magicLinkSentScreen, /setResendState\("error"\)/);
assert.match(magicLinkSentScreen, /accessibilityRole="alert"/);
assert.match(magicLinkSentScreen, /accessibilityLiveRegion="assertive"/);
assert.match(magicLinkSentScreen, /resendSucceeded \|\| resendSubmitting/);
assert.match(magicLinkSentScreen, /<LinkButton label="Use a different email"/);
assert.doesNotMatch(
  authScreen,
  /async function resendLink\(\)[\s\S]{0,180}catch/,
  "the Auth screen must not swallow resend errors"
);

const resendState = {
  status: "idle",
  error: "",
  canRetry: true,
  canChangeEmail: true
};
await simulateResend({
  state: resendState,
  resendImpl: async () => {
    throw new Error("Too many sign-in emails were requested.");
  }
});
assert.deepEqual(
  resendState,
  {
    status: "error",
    error: "Too many sign-in emails were requested.",
    canRetry: true,
    canChangeEmail: true
  },
  "a rejected resend must show its truthful error and preserve both recovery actions"
);

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

async function simulateAuthoritativeSignOut({ state, signOutImpl }) {
  await signOutImpl();
  state.localSession = "cleared";
  state.visibleAccount = "cleared";
}

async function simulateResend({ state, resendImpl }) {
  state.status = "submitting";
  state.error = "";

  try {
    await resendImpl();
    state.status = "success";
    state.canRetry = false;
  } catch (caught) {
    state.status = "error";
    state.error = caught instanceof Error ? caught.message : "Unable to resend your secure link.";
    state.canRetry = true;
  }
}

function resolveProfileAuthPresentation(status) {
  const email = status.isConfigured ? status.user?.email : undefined;
  return {
    email,
    accountLabel: email ? "Manage sign-in" : "Save this profile",
    showLogout: Boolean(email)
  };
}

function isFixtureAuthCallback(value) {
  const url = new URL(value);
  return `${url.hostname}${url.pathname}`.replace(/\/+/g, "/").endsWith("auth/callback");
}

async function simulateInvalidRedirect(state) {
  try {
    throw new Error("That sign-in link is invalid or expired. Request a new secure link.");
  } catch (caught) {
    state.error = caught instanceof Error ? caught.message : "Unable to confirm account.";
  }
}

async function simulateCallbackExchange({ state, exchange, restore }) {
  try {
    const status = await exchange();
    state.authenticated = Boolean(status.user);
    await restore(status);
  } catch (caught) {
    state.error = /network request failed|failed to fetch|networkerror|load failed|fetch/i.test(
      caught instanceof Error ? caught.message : String(caught)
    )
      ? "Lumis could not finish secure sign-in because the connection was interrupted. Check your connection and request a new sign-in link."
      : "That sign-in link is invalid or expired. Request a new secure link.";
  }
}

async function simulateNetworkResumeRetry(exchange) {
  try {
    return await exchange();
  } catch (caught) {
    if (
      !/network request failed|failed to fetch|networkerror|load failed|fetch/i.test(
        caught instanceof Error ? caught.message : String(caught)
      )
    ) {
      throw caught;
    }
    return exchange();
  }
}

async function simulateDeduplicatedCallback(url, processedUrls, exchange) {
  if (processedUrls.has(url)) {
    return;
  }
  processedUrls.add(url);
  await exchange();
}
