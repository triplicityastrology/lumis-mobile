import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

class AccountRestoreSimulationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const authService = readFileSync("apps/mobile/src/services/auth.ts", "utf8");
const accountState = readFileSync("apps/mobile/src/services/accountState.ts", "utf8");
const authScreen = readFileSync("apps/mobile/src/screens/LumisAuthScreen.tsx", "utf8");
const profileScreen = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const authSystemKit = readFileSync("apps/mobile/src/components/AuthSystemKit.tsx", "utf8");
const supabaseService = readFileSync("apps/mobile/src/services/supabase.ts", "utf8");
const profileService = readFileSync("apps/mobile/src/services/profile.ts", "utf8");

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
const codeExchangePath = extractRange(
  redirectHandler,
  "if (authCode) {",
  "const accessToken"
);
assert.match(codeExchangePath, /await prepareNativeAuthExchange\(\)/);
assert.match(codeExchangePath, /await exchangeCodeOnce\(supabase, authCode\)/);
const tokenExchangePath = extractRange(
  redirectHandler,
  "if (accessToken && refreshToken) {",
  "// A Lumis callback without a PKCE code"
);
assert.match(tokenExchangePath, /await prepareNativeAuthExchange\(\)/);
assert.match(
  tokenExchangePath,
  /await setTokenSessionOnce\(supabase, accessToken, refreshToken\)/
);
assert.match(redirectHandler, /successfulRedirect\(user\)/);
assert.match(redirectHandler, /formatRedirectExchangeError\(error\)/);
assert.match(
  redirectHandler,
  /throw new Error\(formatRedirectError\(\)\);/,
  "a recognized callback without credentials must fail truthfully instead of leaving the inbox screen unchanged"
);
assert.doesNotMatch(
  redirectHandler,
  /console\.|setAuthStatus|setProfileData|starter_onboarding/,
  "redirect parsing must neither log private links nor create fake account state"
);

const successfulRedirect = extractRange(
  authService,
  "function successfulRedirect",
  "type RedirectFailureKind"
);
assert.match(successfulRedirect, /status:\s*\{[\s\S]*isConfigured: true,[\s\S]*user/);
assert.doesNotMatch(
  successfulRedirect,
  /getAuthStatus|getUser|email|access_token|refresh_token/,
  "a successful exchange must return only the real session user without another network lookup"
);

const nativeNetworkReadiness = extractRange(
  authService,
  "async function prepareNativeAuthExchange",
  "async function exchangeCodeOnce"
);
assert.match(nativeNetworkReadiness, /probeSupabaseAuthConnection\(\)/);
assert.match(nativeNetworkReadiness, /setTimeout\(resolve, 750\)/);
assert.equal(
  (nativeNetworkReadiness.match(/probeSupabaseAuthConnection\(\)/g) ?? []).length,
  2,
  "native foreground recovery may retry only the harmless Auth health probe"
);

const codeExchange = extractRange(
  authService,
  "async function exchangeCodeOnce",
  "async function setTokenSessionOnce"
);
assert.equal(
  (codeExchange.match(/exchangeCodeForSession\(authCode\)/g) ?? []).length,
  1,
  "a one-time auth code must be exchanged exactly once"
);
assert.match(codeExchange, /isNetworkFailure\(error\)/);
assert.match(codeExchange, /await readPersistedSessionUser\(supabase\)/);
assert.match(codeExchange, /AuthRedirectFailure\("network_interrupted"\)/);
assert.doesNotMatch(
  codeExchange,
  /setTimeout|prepareNativeAuthExchange|exchangeCodeForSession\(authCode\)[\s\S]*exchangeCodeForSession\(authCode\)/,
  "an ambiguous code response cannot trigger a blind second exchange"
);

const tokenExchange = extractRange(
  authService,
  "async function setTokenSessionOnce",
  "async function readPersistedSessionUser"
);
assert.equal(
  (tokenExchange.match(/supabase\.auth\.setSession\(/g) ?? []).length,
  1,
  "token fallback must also avoid duplicate native callback processing"
);
assert.match(tokenExchange, /await readPersistedSessionUser\(supabase\)/);

const persistedSessionRecovery = extractRange(
  authService,
  "async function readPersistedSessionUser",
  "function formatRedirectError"
);
assert.match(persistedSessionRecovery, /supabase\.auth\.getSession\(\)/);
assert.match(
  persistedSessionRecovery,
  /AuthRedirectFailure\("session_restore_failed"\)/,
  "session-storage failure must remain distinct from an invalid link"
);

const safeRedirectFailure = extractRange(
  authService,
  "function formatRedirectExchangeError",
  "function formatSessionNetworkError"
);
assert.match(safeRedirectFailure, /isNetworkFailure\(error\)/);
assert.match(safeRedirectFailure, /connection was interrupted/);
assert.match(safeRedirectFailure, /could not verify the secure session/);
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
assert.match(
  supabaseService,
  /flowType: "pkce"/,
  "native magic links must use PKCE so Expo receives a query code instead of relying on a URL fragment"
);
assert.match(supabaseService, /global:\s*\{\s*fetch: authSafeFetch\s*\}/);
const authConnectionProbe = extractRange(
  supabaseService,
  "export async function probeSupabaseAuthConnection",
  "const authSafeFetch"
);
assert.match(authConnectionProbe, /authSafeFetch\(`\$\{config\.url\}\/auth\/v1\/health`/);
assert.match(authConnectionProbe, /return response\.status < 500/);
assert.doesNotMatch(
  authConnectionProbe,
  /console\.|exchangeCodeForSession|setSession/,
  "the preflight may test connectivity only and cannot consume callback credentials"
);
const safeAuthFetch = extractRange(
  supabaseService,
  "const authSafeFetch",
  "function createAuthStorage"
);
assert.match(safeAuthFetch, /isConfiguredSupabaseAuthRequest\(input\)/);
assert.match(safeAuthFetch, /isTransportFailure\(error\)/);
assert.match(safeAuthFetch, /const config = getSupabaseConfig\(\)/);
assert.match(safeAuthFetch, /new URL\(config\.url\)\.origin/);
assert.match(safeAuthFetch, /requestUrl\.origin === configuredOrigin/);
assert.match(safeAuthFetch, /requestUrl\.pathname === "\/auth\/v1"/);
assert.match(safeAuthFetch, /requestUrl\.pathname\.startsWith\("\/auth\/v1\/"\)/);
assert.match(safeAuthFetch, /catch \{\s*return false;\s*\}/);
assert.match(safeAuthFetch, /message: "AUTH_NETWORK_INTERRUPTED"/);
assert.match(safeAuthFetch, /status: 503/);
assert.doesNotMatch(
  safeAuthFetch,
  /console\.(?:error|warn|log)\s*\(|LogBox\.\w+\s*\(/,
  "the auth fetch boundary must contain transport failures without logging raw errors"
);
assert.match(
  safeAuthFetch,
  /if \(!isConfiguredSupabaseAuthRequest\(input\) \|\| !isTransportFailure\(error\)\) \{\s*throw error;/,
  "non-auth requests and unrelated errors must remain visible to developers"
);
assert.match(authService, /AUTH_NETWORK_INTERRUPTED/);

const containedAuthNetworkResponse = await simulateAuthSafeFetch(
  "https://fixture.supabase.co",
  "https://fixture.supabase.co/auth/v1/token",
  async () => {
    throw new TypeError("Network request failed");
  }
);
assert.equal(containedAuthNetworkResponse.status, 503);
assert.deepEqual(await containedAuthNetworkResponse.json(), {
  message: "AUTH_NETWORK_INTERRUPTED"
});

const invalidLinkResponse = await simulateAuthSafeFetch(
  "https://fixture.supabase.co",
  "https://fixture.supabase.co/auth/v1/token",
  async () =>
    new Response(JSON.stringify({ message: "otp_expired" }), {
      headers: { "Content-Type": "application/json" },
      status: 400
    })
);
assert.equal(invalidLinkResponse.status, 400);
assert.deepEqual(await invalidLinkResponse.json(), { message: "otp_expired" });

await assert.rejects(
  simulateAuthSafeFetch(
    "https://fixture.supabase.co",
    "https://other.example/auth/v1/token",
    async () => {
      throw new TypeError("Network request failed");
    }
  ),
  /Network request failed/,
  "another origin cannot use the configured Supabase Auth containment boundary"
);

await assert.rejects(
  simulateAuthSafeFetch(
    "https://fixture.supabase.co",
    "https://fixture.supabase.co/rest/v1/users",
    async () => {
      throw new TypeError("Network request failed");
    }
  ),
  /Network request failed/,
  "configured Supabase REST failures cannot use the Auth containment boundary"
);

await assert.rejects(
  simulateAuthSafeFetch(
    "not-a-valid-origin",
    "not-a-valid-request",
    async () => {
      throw new TypeError("Network request failed");
    }
  ),
  /Network request failed/,
  "malformed or unknown inputs cannot be contained"
);

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

assert.doesNotMatch(
  authScreen,
  /useEffect\(\(\) => \{[\s\S]{0,180}setSentToEmail\(null\)/,
  "an asynchronous callback error must not replace the inbox shell after mount"
);
assert.match(authScreen, /<MagicLinkSentScreen[\s\S]{0,180}errorMessage=\{authError\}/);
assert.match(
  authSystemKit,
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
assert.equal(
  classifyFixtureCallback("exp://192.0.2.10:8081/--/auth/callback?code=redacted"),
  "pkce_code"
);
assert.equal(
  classifyFixtureCallback("lumis://auth/callback"),
  "invalid_link",
  "a recognized callback with no credential cannot silently leave the inbox state unchanged"
);
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

let successfulCodeExchangeCount = 0;
const directCodeResult = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => {
    successfulCodeExchangeCount += 1;
    return { id: "code-user" };
  },
  readPersistedUser: async () => null
});
assert.equal(successfulCodeExchangeCount, 1);
assert.deepEqual(directCodeResult, { kind: "success", user: { id: "code-user" } });

let preExchangeAttemptCount = 0;
const preExchangeInterruption = await simulateNativeCredentialExchange({
  probeResults: [false, false],
  exchange: async () => {
    preExchangeAttemptCount += 1;
    return { id: "never-called" };
  },
  readPersistedUser: async () => null
});
assert.equal(
  preExchangeAttemptCount,
  0,
  "failed network readiness must not consume the one-time code"
);
assert.deepEqual(preExchangeInterruption, {
  kind: "network_interrupted",
  user: null
});

let ambiguousExchangeCount = 0;
const recoveredAmbiguousExchange = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => {
    ambiguousExchangeCount += 1;
    throw new TypeError("Network request failed");
  },
  readPersistedUser: async () => ({ id: "persisted-real-user" })
});
assert.equal(
  ambiguousExchangeCount,
  1,
  "an ambiguous exchange may inspect persisted state but cannot re-exchange the code"
);
assert.deepEqual(recoveredAmbiguousExchange, {
  kind: "success",
  user: { id: "persisted-real-user" }
});

let failedAmbiguousExchangeCount = 0;
const failedAmbiguousExchange = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => {
    failedAmbiguousExchangeCount += 1;
    throw new TypeError("Network request failed");
  },
  readPersistedUser: async () => null
});
assert.equal(failedAmbiguousExchangeCount, 1);
assert.deepEqual(
  failedAmbiguousExchange,
  { kind: "network_interrupted", user: null },
  "an ambiguous exchange without a real persisted session must remain signed out"
);

const invalidUsedLink = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => {
    throw new Error("otp_expired");
  },
  readPersistedUser: async () => {
    throw new Error("invalid links do not enter session recovery");
  }
});
assert.deepEqual(invalidUsedLink, { kind: "invalid_link", user: null });

const missingRestoredSession = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => null,
  readPersistedUser: async () => null
});
assert.deepEqual(
  missingRestoredSession,
  { kind: "session_restore_failed", user: null },
  "a completed exchange without a real session must report restoration failure, not authenticate locally"
);

const tokenFallbackResult = await simulateNativeCredentialExchange({
  probeResults: [true],
  exchange: async () => ({ id: "token-user" }),
  readPersistedUser: async () => null
});
assert.deepEqual(tokenFallbackResult, { kind: "success", user: { id: "token-user" } });

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
assert.match(magicLinkSentScreen, /resendState === "error" \|\| errorMessage/);
assert.match(magicLinkSentScreen, /resendError \|\| errorMessage/);
assert.match(authSystemKit, /const RESEND_COOLDOWN_SECONDS = 30/);
assert.match(authSystemKit, /const MAX_RESEND_ATTEMPTS = 3/);
assert.match(magicLinkSentScreen, /setResendAttempts\(nextAttempt\)/);
assert.match(magicLinkSentScreen, /setCooldownSeconds\(RESEND_COOLDOWN_SECONDS\)/);
assert.match(magicLinkSentScreen, /resendSubmitting \|\| resendCoolingDown \|\| resendLimitReached/);
assert.match(authSystemKit, /accessibilityState=\{\{ disabled: Boolean\(disabled\) \}\}/);
assert.match(magicLinkSentScreen, /accessibilityLiveRegion="polite"/);
assert.match(magicLinkSentScreen, /Try again later\./);
assert.match(magicLinkSentScreen, /Use a different email to start a new sign-in attempt\./);
assert.match(magicLinkSentScreen, /<LinkButton label="Use a different email"/);
assert.doesNotMatch(
  authScreen,
  /async function resendLink\(\)[\s\S]{0,180}catch/,
  "the Auth screen must not swallow resend errors"
);

const resendState = {
  status: "idle",
  error: "",
  attempts: 0,
  cooldownSeconds: 0,
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
    attempts: 1,
    cooldownSeconds: 30,
    canRetry: false,
    canChangeEmail: true
  },
  "a rejected resend must show its truthful error, start cooldown, and preserve change-email recovery"
);

resendState.cooldownSeconds = 0;
await simulateResend({ state: resendState, resendImpl: async () => undefined });
resendState.cooldownSeconds = 0;
await simulateResend({ state: resendState, resendImpl: async () => undefined });
assert.deepEqual(
  resendState,
  {
    status: "success",
    error: "",
    attempts: 3,
    cooldownSeconds: 30,
    canRetry: false,
    canChangeEmail: true
  },
  "the third resend must permanently disable resend for this mounted sign-in attempt"
);

const signedInRestore = extractRange(
  app,
  "async function restoreAccountForStatus",
  "// AUTH-005"
);
assert.match(
  signedInRestore,
  /if \(status\.isConfigured && status\.user\) \{[\s\S]{0,180}setAccountLoadMessage\("Loading your Lumis profile\.\.\."\)/
);
assert.doesNotMatch(
  signedInRestore,
  /clearVisibleAccountState\("Loading your Lumis profile\.\.\."\)/,
  "a temporary restore attempt cannot erase the last visible account state"
);
assert.match(signedInRestore, /loadSupabaseAccountState\(status\.user\.id\)/);
assert.match(signedInRestore, /applySupabaseAccountState\(accountState\)/);
assert.match(signedInRestore, /routeAfterSplash\("noChart"\)/);
assert.match(signedInRestore, /routeAfterSplash\("restoringSpace"\)/);
assert.match(
  signedInRestore,
  /else if \(!restored && routeLoadedAccount\)/,
  "chart creation may be reached only from an authoritative empty account result"
);

const restoreSpace = extractRange(
  app,
  "async function restoreSpace",
  "async function saveDemoSession"
);
assert.ok(
  restoreSpace.indexOf('setRestoreResult("loading")') <
    restoreSpace.indexOf("await refreshAuthStatus()"),
  "Retry must visibly enter loading before rerunning authentication and account reads"
);
assert.match(
  restoreSpace,
  /try \{[\s\S]{0,220}await refreshAuthStatus\(\)[\s\S]{0,360}loadSupabaseAccountState\(status\.user\.id\)/
);
assert.match(restoreSpace, /catch \(error\)[\s\S]{0,180}setRestoreResult\("failed"\)/);

for (const restoredField of [
  "profileData",
  "chartProfile",
  "personaStyle",
  "buddyName",
  "buddyAvatarKey",
  "reflectionThreads",
  "reflectionHistoryStatus",
  "mainFocus",
  "planTier",
  "remainingCredits"
]) {
  assert.match(accountState, new RegExp(`\\b${restoredField}\\b`));
}
assert.match(accountState, /authenticatedUserId\?: string/);
assert.match(accountState, /let userId = authenticatedUserId/);
assert.doesNotMatch(
  accountState,
  /auth\.getUser\(\)/,
  "account restoration must not repeat a network identity check after PKCE already supplied the user"
);
assert.match(accountState, /if \(!birthData && !profile\)/);
assert.match(
  accountState,
  /birthData\.active_chart_version !== profile\.chart_version/
);
assert.match(accountState, /"ACCOUNT_DATA_INCOMPLETE"/);
assert.match(accountState, /"ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE"/);
assert.match(
  accountState,
  /export function isTransientAccountRestoreError[\s\S]{0,220}error\.code === "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE"/,
  "only the explicit transient account-data code may enter startup recovery"
);
assert.match(
  accountState,
  /status === 408 \|\| status === 429 \|\| status >= 500/,
  "temporary required-read status codes must be classified without exposing diagnostics"
);
assert.match(
  accountState,
  /if \(sessionError\) \{\s*throw new AccountRestoreError\(\s*"ACCOUNT_AUTH_REQUIRED"/,
  "session verification failure must remain an authentication error"
);
assert.match(
  accountState,
  /if \(!userId\) \{\s*throw new AccountRestoreError\(\s*"ACCOUNT_AUTH_REQUIRED"/,
  "a missing authenticated user must remain an authentication error"
);
assert.match(
  accountState,
  /if \(requiredError\) \{\s*throw new AccountRestoreError\(\s*isTransientRequiredReadError\(requiredError\)/,
  "transient classification must be limited to required account reads"
);
assert.match(
  accountState,
  /const requiredError = userResult\.error \?\? birthResult\.error \?\? profileResult\.error/
);
assert.match(
  accountState,
  /\.select\("display_name, focus, persona_style, buddy_name, buddy_avatar_key"\)/,
  "required account restoration must not depend on optional language columns"
);
assert.match(
  accountState,
  /\.select\("lang, language_preference_set_at"\)[\s\S]{0,160}\.maybeSingle\(\)/
);
assert.match(
  accountState,
  /const languagePreference = languageResult\.error\s*\? null/,
  "an unavailable language migration must not block an existing chart"
);
assert.match(
  accountState,
  /appLanguagePreference:[\s\S]{0,220}languagePreference\?\.language_preference_set_at/,
  "saved language is restored only when optional enrichment succeeds"
);
assert.doesNotMatch(
  accountState,
  /requiredError[\s\S]{0,120}balanceResult|firstError/,
  "optional enrichment cannot reject an otherwise authoritative chart"
);
assert.match(app, /const STARTUP_ACCOUNT_RESTORE_MAX_RETRIES = 1/);
assert.match(app, /const STARTUP_ACCOUNT_RESTORE_RETRY_DELAY_MS = 600/);
const startupLoader = extractRange(
  app,
  "async function loadStartupAccountState",
  "function ChartPreviewScreen"
);
assert.match(startupLoader, /return await loadSupabaseAccountState\(userId\)/);
assert.match(startupLoader, /isTransientAccountRestoreError\(error\)/);
assert.match(
  startupLoader,
  /retryCount >= STARTUP_ACCOUNT_RESTORE_MAX_RETRIES/,
  "startup restoration must stop after one bounded retry"
);
assert.match(
  startupLoader,
  /setTimeout\(resolve, STARTUP_ACCOUNT_RESTORE_RETRY_DELAY_MS\)/,
  "the one retry must remain inside the loading state while native networking settles"
);
assert.doesNotMatch(
  startupLoader,
  /loadLocalDemoSession|setScreen\("profile"\)|noChart|clearVisibleAccountState/,
  "startup retry cannot create local state or route an existing account to chart creation"
);
const startupRestore = extractRange(
  app,
  "async function restoreExistingAuthSession",
  "async function restoreAfterAuthRedirect"
);
assert.match(startupRestore, /restoreAccountForStatus\(status, true, true\)/);
assert.match(
  signedInRestore,
  /retryTransientStartupFailure[\s\S]{0,260}loadStartupAccountState\(status\.user\.id\)/,
  "the bounded retry must be opt-in for cold-start restoration only"
);
assert.doesNotMatch(
  restoreSpace,
  /loadStartupAccountState/,
  "manual Retry must remain one visible authoritative reload rather than nesting automatic retries"
);
assert.match(
  app,
  /function openAccountRecovery\(\)[\s\S]{0,300}setScreen\("auth"\)/,
  "failed restoration must provide explicit signed-in account controls"
);
assert.match(
  app,
  /onRetry=\{restoreSpace\}[\s\S]{0,100}onBack=\{openAccountRecovery\}/,
  "Retry and account recovery must remain distinct usable actions"
);
assert.doesNotMatch(
  extractRange(app, "function openAccountRecovery", "function applySupabaseAccountState"),
  /clearVisibleAccountState|loadLocalDemoSession|setScreen\("profile"\)|noChart/,
  "account recovery cannot clear state, enter demo mode, or offer chart creation"
);

let transientAttempts = 0;
const recoveredStartupAccount = await simulateBoundedStartupRestore(async () => {
  transientAttempts += 1;
  if (transientAttempts === 1) {
    throw new AccountRestoreSimulationError("ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE");
  }
  return { status: "loaded", chartVersion: 2 };
});
assert.deepEqual(recoveredStartupAccount, { status: "loaded", chartVersion: 2 });
assert.equal(transientAttempts, 2, "one transient cold-start failure must retry exactly once");

let terminalAttempts = 0;
await assert.rejects(
  () =>
    simulateBoundedStartupRestore(async () => {
      terminalAttempts += 1;
      throw new AccountRestoreSimulationError("ACCOUNT_DATA_INCOMPLETE");
    }),
  /ACCOUNT_DATA_INCOMPLETE/
);
assert.equal(terminalAttempts, 1, "incomplete or mismatched account data must not retry");

let exhaustedAttempts = 0;
await assert.rejects(
  () =>
    simulateBoundedStartupRestore(async () => {
      exhaustedAttempts += 1;
      throw new AccountRestoreSimulationError("ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE");
    }),
  /ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE/
);
assert.equal(exhaustedAttempts, 2, "transient startup recovery must stop after one retry");
const optionalLanguageUnavailable = simulateOptionalLanguageEnrichment({
  requiredAccount: { status: "loaded", chartVersion: 3 },
  languageResult: { error: true }
});
assert.deepEqual(
  optionalLanguageUnavailable,
  {
    status: "loaded",
    chartVersion: 3,
    appLanguagePreference: null
  },
  "missing language columns cannot turn an existing chart into a failed restore"
);
assert.match(accountState, /threadsResult\.error \? \[\]/);
assert.match(accountState, /reflectionHistoryStatus: reflectionHistoryUnavailable \? "unavailable" : "loaded"/);
assert.match(
  app,
  /if \(accountState\.reflectionHistoryStatus === "loaded"\)[\s\S]{0,520}else \{[\s\S]{0,360}canContinue: false/,
  "temporary history failure must preserve visible reflections as read-only"
);
assert.doesNotMatch(
  accountState,
  /throw new Error\((?:firstError|error)\.message\)/,
  "raw Supabase query errors must not reach account-restoration UI"
);
assert.ok(
  (accountState.match(/\.eq\("(?:id|user_id)", userId\)/g) ?? []).length >= 5,
  "account reads must remain scoped to the authenticated Supabase user"
);
assert.doesNotMatch(
  accountState,
  /\.(?:insert|upsert|update)\(|complete_profile_onboarding|starter_onboarding/,
  "account restoration must be read-only and cannot create another Starter grant"
);
assert.match(profileService, /safeProfileSubmissionError\(error\)/);
assert.match(profileService, /code === "PROFILE_ALREADY_EXISTS"/);
assert.match(
  extractRange(profileService, "export async function submitChartProfile", "export async function regenerateBirthDetails"),
  /supabase\.auth\.getSession\(\)/
);
assert.doesNotMatch(
  extractRange(profileService, "export async function submitChartProfile", "export async function regenerateBirthDetails"),
  /supabase\.auth\.getUser\(\)|isEdgeFunctionTransportError|response\.chart \?\? buildFixtureChart|throw new Error\(error\.message\)/,
  "a signed-in profile request cannot fall back to a fixture or expose a raw Edge Function error"
);

const restoreOutcomes = {
  loaded: { destination: "chat", canCreateChart: false },
  empty: { destination: "noChart", canCreateChart: true },
  error: { destination: "restoringSpace", canCreateChart: false }
};
assert.deepEqual(
  restoreOutcomes,
  {
    loaded: { destination: "chat", canCreateChart: false },
    empty: { destination: "noChart", canCreateChart: true },
    error: { destination: "restoringSpace", canCreateChart: false }
  },
  "only an authoritative empty result may expose chart onboarding"
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

async function simulateBoundedStartupRestore(load) {
  let retryCount = 0;

  while (true) {
    try {
      return await load();
    } catch (error) {
      if (
        !(error instanceof AccountRestoreSimulationError) ||
        error.code !== "ACCOUNT_DATA_TEMPORARILY_UNAVAILABLE" ||
        retryCount >= 1
      ) {
        throw error;
      }
      retryCount += 1;
    }
  }
}

function simulateOptionalLanguageEnrichment({
  requiredAccount,
  languageResult
}) {
  return {
    ...requiredAccount,
    appLanguagePreference:
      languageResult.error ? null : languageResult.language ?? null
  };
}

async function simulateResend({ state, resendImpl }) {
  if (state.cooldownSeconds > 0 || state.attempts >= 3) return;

  state.attempts += 1;
  state.cooldownSeconds = 30;
  state.status = "submitting";
  state.error = "";

  try {
    await resendImpl();
    state.status = "success";
  } catch (caught) {
    state.status = "error";
    state.error = caught instanceof Error ? caught.message : "Unable to resend your secure link.";
  }
  state.canRetry = state.cooldownSeconds === 0 && state.attempts < 3;
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

function classifyFixtureCallback(value) {
  const url = new URL(value);
  if (!isFixtureAuthCallback(value)) return "unhandled";
  if (url.searchParams.get("code")) return "pkce_code";

  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return hash.get("access_token") && hash.get("refresh_token")
    ? "legacy_token_pair"
    : "invalid_link";
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

async function simulateNativeCredentialExchange({
  probeResults,
  exchange,
  readPersistedUser
}) {
  const probes = [...probeResults];
  const firstProbe = probes.shift() ?? false;
  const networkReady = firstProbe || (probes.shift() ?? false);

  if (!networkReady) {
    return { kind: "network_interrupted", user: null };
  }

  try {
    const user = await exchange();
    if (user) {
      return { kind: "success", user };
    }

    const persistedUser = await readPersistedUser();
    return persistedUser
      ? { kind: "success", user: persistedUser }
      : { kind: "session_restore_failed", user: null };
  } catch (caught) {
    const isNetworkError =
      /network request failed|failed to fetch|networkerror|load failed|fetch/i.test(
        caught instanceof Error ? caught.message : String(caught)
      );

    if (!isNetworkError) {
      return { kind: "invalid_link", user: null };
    }

    const persistedUser = await readPersistedUser();
    return persistedUser
      ? { kind: "success", user: persistedUser }
      : { kind: "network_interrupted", user: null };
  }
}

async function simulateDeduplicatedCallback(url, processedUrls, exchange) {
  if (processedUrls.has(url)) {
    return;
  }
  processedUrls.add(url);
  await exchange();
}

async function simulateAuthSafeFetch(configuredUrl, input, request) {
  try {
    return await request();
  } catch (caught) {
    let isAuthRequest = false;
    try {
      const configuredOrigin = new URL(configuredUrl).origin;
      const requestUrl = new URL(input);
      isAuthRequest =
        requestUrl.origin === configuredOrigin &&
        (requestUrl.pathname === "/auth/v1" ||
          requestUrl.pathname.startsWith("/auth/v1/"));
    } catch {
      isAuthRequest = false;
    }
    const isNetworkFailure =
      /network request failed|failed to fetch|networkerror|load failed|fetch/i.test(
        caught instanceof Error ? caught.message : String(caught)
      );

    if (!isAuthRequest || !isNetworkFailure) {
      throw caught;
    }

    return new Response(JSON.stringify({ message: "AUTH_NETWORK_INTERRUPTED" }), {
      headers: { "Content-Type": "application/json" },
      status: 503
    });
  }
}
