import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/mobile/App.tsx");
const screensPath = path.join(root, "apps/mobile/src/screens");
const featuresPath = path.join(root, "apps/mobile/src/features");
const mainTabBarPath = path.join(root, "apps/mobile/src/components/MainTabBar.tsx");
const appSource = await readFile(appPath, "utf8");
const mainTabBarSource = await readFile(mainTabBarPath, "utf8");
const celestialBackgroundSource = await readFile(
  path.join(root, "apps/mobile/src/components/CelestialBackground.tsx"),
  "utf8"
);
const homeScreenSource = await readFile(
  path.join(root, "apps/mobile/src/screens/LumisHomeScreen.tsx"),
  "utf8"
);
const authScreen = await readFile(
  path.join(root, "apps/mobile/src/screens/LumisAuthScreen.tsx"),
  "utf8"
);
const flowScreenSource = await readFile(
  path.join(root, "apps/mobile/src/components/FlowScreen.tsx"),
  "utf8"
);
const authSystemKit = await readFile(
  path.join(root, "apps/mobile/src/components/AuthSystemKit.tsx"),
  "utf8"
);
const accountStateSource = await readFile(path.join(root, "apps/mobile/src/services/accountState.ts"), "utf8");
const authSource = await readFile(path.join(root, "apps/mobile/src/services/auth.ts"), "utf8");
const profileSource = await readFile(path.join(root, "apps/mobile/src/services/profile.ts"), "utf8");
const chatSource = await readFile(path.join(root, "apps/mobile/src/services/chat.ts"), "utf8");
const generatingSource = await readFile(path.join(root, "apps/mobile/src/components/GeneratingView.tsx"), "utf8");
const diceSource = await readFile(path.join(screensPath, "LumisDiceScreen.tsx"), "utf8");
const diceRitualSource = await readFile(
  path.join(featuresPath, "dice/DiceRitualScreen.tsx"),
  "utf8"
);
const diceResultLayoutSource = await readFile(
  path.join(featuresPath, "dice/useDiceResultActionLayout.ts"),
  "utf8"
);
const diceHistorySource = await readFile(
  path.join(featuresPath, "dice/DiceHistorySheet.tsx"),
  "utf8"
);
const careCircleSource = await readFile(
  path.join(featuresPath, "careCircle/CareCircleScreen.tsx"),
  "utf8"
);
const birthDetailsSource = await readFile(
  path.join(featuresPath, "birthDetails/BirthDetailsChangeScreen.tsx"),
  "utf8"
);
// Authority rule C: Rising/Ascendant is surfaced in Birth Details ONLY for a
// full-precision (timed) chart; unknown-time charts show Sun + Moon only.
assert.match(birthDetailsSource, /chart\.precision === "full" && asc/);
assert.match(birthDetailsSource, /Lumis hides Rising, houses, and the Ascendant/);
// Authority rule D: three LIFETIME changes (not per-year).
assert.match(birthDetailsSource, /lifetime changes remaining/);
assert.match(birthDetailsSource, /a lifetime limit/);
// Authority rule D: regeneration uses an honest indeterminate loader — no fake
// timed step-completion that claims backend progress.
assert.match(birthDetailsSource, /indeterminate/);
assert.doesNotMatch(birthDetailsSource, /setTimeout\(\(\) => setRegenStep/);
const notificationCenterSource = await readFile(
  path.join(featuresPath, "notifications/NotificationCenterScreen.tsx"),
  "utf8"
);
const profileScreenSource = await readFile(path.join(screensPath, "LumisProfileScreen.tsx"), "utf8");
const insightsSource = await readFile(path.join(screensPath, "ChartInsightsScreen.tsx"), "utf8");
const screenFiles = (await readdir(screensPath))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => path.join(screensPath, name));
const featureFiles = await listTsxFiles(featuresPath);

const scannedSurfaces = [
  { name: "App surfaces", source: appSource },
  ...await Promise.all([...screenFiles, ...featureFiles].map(async (file) => ({
    name: path.relative(root, file),
    source: await readFile(file, "utf8")
  })))
];

for (const surface of scannedSurfaces) {
  assertNoVisibleBilling(surface.source, surface.name);
}

assert.doesNotMatch(
  appSource,
  /["'](?:plans|paywall)["']/,
  "preview navigation cannot expose Plans or Paywall routes"
);
assert.doesNotMatch(appSource, /function (?:PlansAccessScreen|PaywallScreen)\b/);
assert.doesNotMatch(appSource, /setScreen\("(?:plans|paywall|topup|purchase|upgrade)"\)/i);
assert.doesNotMatch(profileScreenSource, /Credit balance|onPlans|planTier|remainingCredits/);
assert.doesNotMatch(profileScreenSource, /Export my data|Data export/);
assert.match(
  diceSource,
  /Dice reading preview\./,
  "the fallback Dice result must use neutral preview wording"
);
assert.match(
  diceRitualSource,
  /Dice reading preview\./,
  "the default Dice result must use neutral preview wording"
);
assert.doesNotMatch(diceSource, /credits charged|price|payment|top-up|purchase/i);
assert.doesNotMatch(diceRitualSource, /credits charged|price|payment|top-up|purchase/i);
assert.doesNotMatch(appSource, /accessibilityLabel="Credit estimate"/i);
assert.doesNotMatch(appSource, /test mode:\s*no charge/i);
assert.match(mainTabBarSource, /label: "Talk"/);
assert.match(mainTabBarSource, /label: "Insights"/);
assert.match(mainTabBarSource, /label: "Dice"/);
assert.match(mainTabBarSource, /label: "You"/);
assert.match(appSource, /<MainTabBar active="chat"/);
assert.match(appSource, /restoreAccountForStatus\(status, true, true\)/);
const accountEntryHandler = extractRange(
  appSource,
  "function openAccountEntry",
  "function requestAuthoritativeLogout"
);
assert.match(accountEntryHandler, /setScreen\("auth"\)/);
assert.doesNotMatch(
  accountEntryHandler,
  /refreshAuthStatus|getAuthStatus|setAuthStatus|setAuthNotice|\buser:/,
  "account entry cannot trigger a delayed visible auth update or manufacture authentication"
);
assert.match(appSource, /onAccount=\{openAccountEntry\}/);
assert.match(
  flowScreenSource,
  /import \{ SafeAreaView(, type Edge)? \} from "react-native-safe-area-context"/,
  "Auth and onboarding must use the same provider-backed safe-area geometry as Home"
);
assert.doesNotMatch(
  flowScreenSource,
  /import \{[^}]*SafeAreaView[^}]*\} from "react-native"/,
  "the shared destination shell cannot mix React Native safe-area layout with the app provider"
);
assert.match(
  flowScreenSource,
  /<SafeAreaView edges=\{edges\}/,
  "FlowScreen applies its (overridable) edges prop"
);
assert.match(
  flowScreenSource,
  /edges = \["top", "left", "right", "bottom"\]/,
  "FlowScreen default owns a stable full safe area for onboarding callers"
);
assert.match(
  flowScreenSource,
  /contentInsetAdjustmentBehavior="never"/,
  "flow screens must not receive a second automatic iOS safe-area inset after mount"
);
assert.match(
  flowScreenSource,
  /keyboardShouldPersistTaps="handled"/,
  "stable flow geometry must preserve interactive keyboard forms"
);
assert.match(
  homeScreenSource,
  /contentInsetAdjustmentBehavior="never"/,
  "the signed-out Home scroll view must opt out of post-mount automatic inset adjustment"
);
assert.doesNotMatch(
  homeScreenSource,
  /welcomeContent:\s*\{[^}]*justifyContent:\s*"center"/,
  "variable-height welcome content cannot be vertically recentered after child measurement"
);
// HOME-001 (8/8/2026 Founder rebuild): approved Welcome — bilingual eyebrow,
// "Map my sky" gradient CTA, EN/中 toggle, small compass mark; the top-right
// "Sign in" button and "Get started" copy are removed (superseded intentionally).
for (const welcomeAction of [
  '"Map my sky"',
  '"I already have an account"',
  "Meet Lumis, your inner universe.",
  "NOT JUST A HOROSCOPE.",
  "<CompassMark",
  "<LanguageToggle"
]) {
  assert.match(homeScreenSource, new RegExp(escapeRegExp(welcomeAction)));
}
assert.doesNotMatch(homeScreenSource, /"Sign in"/, "HOME-001 has no top-right Sign in button");
assert.doesNotMatch(homeScreenSource, /A private space shaped by your birth chart/, "HOME-001 uses the approved title");
assert.ok(
  (homeScreenSource.match(/props\.onAccount/g) ?? []).length >= 3,
  "all three signed-out welcome actions must reach the shared account entry"
);
// HOME-001 accepted design must remain (unchanged in this correction pass).
assert.match(homeScreenSource, /Meet Lumis, your inner universe\./, "HOME-001 approved title preserved");
assert.match(homeScreenSource, /Map my sky/, "HOME-001 approved primary CTA preserved");

/* ---------------- AUTH-001 provider selection (8/8/2026 rebuild + correction) ---------------- */
// Approved header / eyebrow / title / providers / privacy card / legal footer.
assert.match(authScreen, /✦ CREATE YOUR ACCOUNT/, "AUTH-001 eyebrow");
assert.match(authScreen, /Create your safe space\./, "AUTH-001 title");
assert.match(authScreen, /One account to sync your charts and private reflections\./, "AUTH-001 sub");
assert.match(authScreen, /Continue with Apple/, "AUTH-001 Apple provider button");
assert.match(authScreen, /Continue with Google/, "AUTH-001 Google provider button");
assert.match(authScreen, /Continue with email/, "AUTH-001 email provider button");
assert.match(authScreen, /<LanguageToggle/, "AUTH-001 EN / 中 selector");
assert.match(authScreen, /Your birth data and conversations stay strictly private\. You can delete your space anytime\./, "AUTH-001 privacy caveat card");
assert.match(authScreen, /By continuing you agree to our/, "AUTH-001 legal footer");
// Apple / Google cannot fabricate authentication — both route to the truthful
// unavailable handler, and no provider sign-in call exists on this screen.
assert.match(authScreen, /providerUnavailable\("Apple"\)/, "AUTH-001 Apple stays unavailable (no fabricated auth)");
assert.match(authScreen, /providerUnavailable\("Google"\)/, "AUTH-001 Google stays unavailable (no fabricated auth)");
assert.match(authScreen, /isn't available in this build yet/, "AUTH-001 provider unavailable message is truthful");
assert.doesNotMatch(authScreen, /signInWithApple|signInWithGoogle|AppleAuthentication|GoogleSignin|ASAuthorization/, "AUTH-001 wires no real provider auth");
// "Continue with email" switches to the real magic-link email mode, which stays
// connected to the existing sendMagicLink boundary (validation / error / sent / resend).
assert.match(authScreen, /setMode\("email"\)/, "AUTH-001 email button opens the magic-link mode");
assert.match(authScreen, /mode === "email"/, "AUTH-001 renders a dedicated email mode");
assert.match(authScreen, /sendMagicLink/, "AUTH-001 email mode uses the existing sendMagicLink boundary");
assert.match(authScreen, /Please enter a valid email address\./, "AUTH-001 email validation preserved");
assert.match(authScreen, /<MagicLinkSentScreen/, "AUTH-001 sent state preserved");
assert.match(authScreen, /resendLink/, "AUTH-001 resend preserved");
// Exactly one top-safe-area owner: App.tsx owns top for screen === "auth"; the
// auth screen and its FlowScreen modes must NOT re-apply the top edge.
assert.match(appSource, /screen === "auth"[\s\S]{0,120}usesPersistentNavigationInsets|usesPersistentNavigationInsets[\s\S]{0,120}screen === "auth"/, "App viewport owns top inset for screen === auth");
assert.doesNotMatch(authScreen, /edges=\{\["top"/, "AUTH-001 never re-applies the top safe-area edge (single owner)");
assert.match(authScreen, /edges=\{\["bottom"\]\}/, "AUTH-001 owns only the bottom safe area");
assert.equal((authScreen.match(/edges=\{\[/g) ?? []).length, 3, "AUTH-001 has exactly one edges owner per mode (provider + email + signed-in), none with top");
// FlowScreen supports the bottom-only override without changing its default.
assert.match(flowScreenSource, /edges = \["top", "left", "right", "bottom"\]/, "FlowScreen default edges unchanged for other callers");
assert.match(
  celestialBackgroundSource,
  /<View pointerEvents="none" style=\{styles\.fill\} accessibilityElementsHidden>/,
  "the single root celestial background must never participate in hit testing"
);
assert.equal(
  (appSource.match(/<CelestialBackground variant=\{skyVariant\} \/>/g) ?? []).length,
  1,
  "the app must retain one shared root celestial background"
);
assert.match(
  appSource,
  /<View[\s\S]{0,180}collapsable=\{false\}[\s\S]{0,180}onLayout=\{recordScreenViewportLayout\}[\s\S]{0,180}style=\{\[styles\.screenViewport, persistentNavigationInsets\]\}[\s\S]{0,120}\{renderScreen\(\)\}/,
  "root navigation must swap content inside one persistent native viewport"
);
assert.match(
  appSource,
  /screenViewport:\s*\{\s*\.\.\.StyleSheet\.absoluteFillObject,\s*overflow:\s*"hidden"\s*\}/,
  "the persistent viewport must not participate in destination content measurement"
);
assert.match(
  appSource,
  /const stableSafeAreaInsets = useSafeAreaInsets\(\)/,
  "the persistent app root must subscribe to safe-area geometry before tab screens mount"
);
assert.match(
  appSource,
  /const isMainTabScreen =[\s\S]{0,180}screen === "chat"[\s\S]{0,180}screen === "profileTab"/,
  "all main tabs must share one persistent safe-area owner"
);
assert.match(
  appSource,
  /paddingTop: stableSafeAreaInsets\.top[\s\S]{0,120}paddingLeft: stableSafeAreaInsets\.left[\s\S]{0,120}paddingRight: stableSafeAreaInsets\.right/,
  "main-tab top and side insets must be applied by the persistent viewport"
);
assert.match(
  appSource,
  /const usesPersistentNavigationInsets =[\s\S]{0,360}isMainTabScreen[\s\S]{0,360}screen === "home"[\s\S]{0,360}screen === "auth"[\s\S]{0,360}screen === "persona"[\s\S]{0,360}screen === "reflections"/,
  "Back-context sources and destinations must retain one persistent top/side safe-area owner"
);
assert.match(
  appSource,
  /function PersonaStyleScreen[\s\S]*?<SafeAreaViewCtx edges=\{\["bottom"\]\}[\s\S]*?function PastReflectionsScreen[\s\S]*?<SafeAreaViewCtx edges=\{\["bottom"\]\}/,
  "Persona and Past Reflections cannot remount a native top inset during contextual Back"
);
assert.match(
  authSystemKit,
  /export function AuthShell[\s\S]{0,180}<SafeAreaView edges=\{\["bottom"\]\}/,
  "Manage sign-in must leave top/side safe-area ownership on the persistent viewport"
);
assert.match(
  homeScreenSource,
  /export function LumisHomeScreen[\s\S]*?<SafeAreaView edges=\{\[\]\}[\s\S]*?function WelcomeState[\s\S]*?<SafeAreaView edges=\{\["top", "bottom"\]\}/,
  "Home cannot remount a native top inset when contextual Back restores it"
);
assert.match(
  appSource,
  /if \(__DEV__\)[\s\S]{0,220}event: "shell_layout"[\s\S]{0,220}route: screen[\s\S]{0,220}safeArea: stableSafeAreaInsets[\s\S]{0,220}shellHeight: height/,
  "device geometry diagnostics must remain DEV-only and contain only layout state"
);
for (const [name, source] of [
  ["Insights", insightsSource],
  ["Profile", profileScreenSource],
  ["default Dice ritual", diceRitualSource],
  ["fallback Dice", diceSource]
]) {
  assert.doesNotMatch(
    source,
    /SafeAreaView/,
    `${name} cannot remount a second main-tab safe-area subscriber`
  );
}
const chatShellSource = extractRange(
  appSource,
  "function ChatShellScreen",
  "function PastReflectionsScreen"
);
// Chat root is the keyboard-avoiding container (founder return: composer must
// stay above the iOS keyboard) styled with lumisDarkSafe.
assert.match(chatShellSource, /return \(\s*<KeyboardAvoidingView\s+style=\{styles\.lumisDarkSafe\}/);
assert.doesNotMatch(
  chatShellSource,
  /SafeAreaViewCtx/,
  "Chat cannot remount a second main-tab safe-area subscriber"
);
assert.doesNotMatch(
  appSource,
  /<CelestialBackground variant=\{skyVariant\} \/>\s*\{renderScreen\(\)\}/,
  "screen components cannot remain direct layout children of the root sky"
);
assert.match(
  authScreen,
  /<TextInput[\s\S]{0,420}value=\{email\}[\s\S]{0,420}onChangeText=\{setEmail\}/,
  "the account entry email field must remain interactive"
);
// A restored account still routes to Chat; navigation is deferred past the splash
// via routeAfterSplash (which resolves to setScreen("chat")).
assert.match(appSource, /if \(restored && routeLoadedAccount\)[\s\S]{0,120}routeAfterSplash\("chat"\)/);
assert.match(
  appSource,
  /else if \(!restored && routeLoadedAccount\)[\s\S]{0,100}routeAfterSplash\("noChart"\)/,
  "only a confirmed empty account may route into no-chart onboarding"
);
assert.match(
  appSource,
  /catch \(error\)[\s\S]{0,320}routeAfterSplash\("restoringSpace"\)/,
  "temporary restoration failures must remain in the retryable restore flow"
);
assert.match(homeScreenSource, /const canCreateChart = props\.isAuthenticated && props\.accountLoadStatus === "empty"/);
assert.match(homeScreenSource, /const restoreFailed = props\.isAuthenticated && props\.accountLoadStatus === "error"/);
assert.match(homeScreenSource, /restoreFailed\s*\?\s*props\.onReload/);
// HOME-002 (rule C): Rising is gated on full precision — a no_birth_time chart
// with stale/malformed Ascendant data must still show Sun + Moon only.
assert.match(homeScreenSource, /const rising = props\.chart\.precision === "full" \? findPoint\(props\.chart, "ascendant"\) : undefined/);
assert.match(authSystemKit, /<PrimaryButton label="Retry" onPress=\{onRetry\} \/>/);
assert.match(authSystemKit, /<LinkButton label="Back to account" onPress=\{onBack\} \/>/);
assert.match(
  appSource,
  /async function restoreSpace\(origin: "reload" \| "retry" = "reload"\)[\s\S]{0,180}setRestoreResult\("loading"\)[\s\S]{0,260}try \{[\s\S]{0,160}await refreshAuthStatus\(\)/
);
assert.match(appSource, /function routeAfterSplash[\s\S]{0,220}setScreen\(target\)/);
assert.match(
  appSource,
  /useFonts\(FONT_ASSETS\)/,
  "bundled fonts must still load through the approved Expo font boundary"
);
assert.doesNotMatch(
  appSource,
  /if \(!fontsReady\)[\s\S]{0,180}<LumisSplashScreen onDone=\{\(\) => \{\}\}/,
  "font loading must never replace the splash completion callback with a no-op"
);
assert.match(appSource, /accessibilityLabel="Past Reflections"/);
assert.match(appSource, /placeholder="Search reflections"/);
assert.match(appSource, /Start a new topic/);
assert.match(appSource, /Continue reflection/);
assert.match(appSource, /Read reflection/);
assert.match(appSource, /SAVED INSIGHTS/);
assert.doesNotMatch(appSource, /Use Save insight on a Lumis reply/);
assert.match(appSource, /Saved Insights will appear here after this feature becomes available/);
assert.match(appSource, /const filteredThreads = normalizedQuery/);
assert.match(appSource, /No matching reflections/);
assert.match(
  appSource,
  /function openNotifications\(\)[\s\S]{0,420}setNotificationsReturn\([\s\S]{0,220}setScreen\("notifications"\)/,
  "notification helper must remember the originating main tab and open Notifications"
);
assert.ok(
  (appSource.match(/onNotifications=\{openNotifications\}/g) ?? []).length >= 5,
  "Home, Chat, Insights, Dice, and Profile must share the Notifications entry point"
);
assert.match(appSource, /<Bell[^>]+size=\{18\}/);
await assertScreenUsesTab("ChartInsightsScreen.tsx", "insights");
await assertScreenUsesTab("LumisDiceScreen.tsx", "dice");
await assertScreenUsesTab("LumisProfileScreen.tsx", "profile");
assert.match(insightsSource, /accessibilityLabel="Notifications"/);
assert.match(diceSource, /type DiceStep = "ask" \| "shake" \| "result"/);
assert.match(diceSource, /Accelerometer\.addListener/);
assert.match(diceSource, /<OctaDie/);
assert.match(diceSource, /Reflect in Chat/);
assert.match(diceSource, /function cancelRoll\(\)[\s\S]{0,160}clearRollTimers\(\)/);
assert.match(diceSource, /onPress=\{step === "result" \? reset : cancelRoll\}/);
for (const [name, source] of [
  ["default Dice ritual", diceRitualSource],
  ["fallback Dice screen", diceSource],
  ["Dice history", diceHistorySource]
]) {
  assert.doesNotMatch(
    source,
    /What should I notice right now\?/,
    `${name} cannot silently substitute a question`
  );
}
assert.match(diceRitualSource, /activeQuestionRef\.current = normalizedQuestion/);
assert.match(diceSource, /const normalizedQuestion = normalizeDiceQuestion\(question\)/);
assert.match(
  diceRitualSource,
  /const rethrow = useCallback\(\(\) => \{[\s\S]{0,900}questionRef\.current = nextQuestion\.draft[\s\S]{0,240}activeQuestionRef\.current = nextQuestion\.activeQuestion[\s\S]{0,240}setQuestion\(nextQuestion\.draft\)[\s\S]{0,240}transition\("IDLE"\)/,
  "Physics Dice must clear both draft and submitted question state before another throw"
);
assert.match(
  diceSource,
  /function reset\(\) \{[\s\S]{0,260}setQuestion\(nextQuestion\.draft\)[\s\S]{0,160}setActiveQuestion\(nextQuestion\.activeQuestion\)/,
  "fallback Dice must require a new question after Roll again"
);
for (const [name, source] of [
  ["default Dice ritual", diceRitualSource],
  ["fallback Dice screen", diceSource]
]) {
  assert.match(
    source,
    /const \{ stackResultActions \} = useDiceResultActionLayout\(\)/,
    `${name} must use the shared live Dynamic Type result-action layout`
  );
  assert.match(
    source,
    /numberOfLines=\{(?:singleLine \? 1 : undefined|stackResultActions \? undefined : 1)\}/,
    `${name} must keep normal-width labels on one line without clipping large text`
  );
}
assert.match(diceResultLayoutSource, /PixelRatio\.getFontScale\(\)/);
assert.match(
  diceResultLayoutSource,
  /Dimensions\.addEventListener\("change"[\s\S]{0,220}readNativeFontScale\(window\.fontScale\)/,
  "Dice result actions must react when native font-scale dimensions change"
);
assert.match(
  diceResultLayoutSource,
  /AppState\.addEventListener\("change"[\s\S]{0,180}state === "active"[\s\S]{0,180}readNativeFontScale/,
  "Dice result actions must refresh native font scale after returning from iOS Settings"
);
assert.match(diceResultLayoutSource, /const LARGE_TEXT_RESULT_ACTION_SCALE = 1\.3/);
assert.match(
  diceResultLayoutSource,
  /effectiveFontScale >= LARGE_TEXT_RESULT_ACTION_SCALE/,
  "large accessibility text must stack actions before labels can clip"
);
assert.match(diceRitualSource, /sheetActionRoll: \{ flex: 1 \}/);
assert.match(diceRitualSource, /sheetActionReflect: \{ flex: 1\.65 \}/);
assert.match(diceSource, /secondaryButton:[\s\S]{0,220}flex: 1/);
assert.match(diceSource, /chatButton:[\s\S]{0,220}flex: 1\.65/);
assert.match(diceHistorySource, /const QUESTION_UNAVAILABLE = "Question unavailable"/);
for (const [name, source] of [
  ["Profile", profileScreenSource],
  ["fallback Dice", diceSource],
  ["Dice history", diceHistorySource],
  ["Care Circle", careCircleSource],
  ["Birth Details", birthDetailsSource]
]) {
  assert.match(
    source,
    /contentInsetAdjustmentBehavior="never"/,
    `${name} must not accept a second automatic iOS content inset after mount`
  );
}
for (const [name, source] of [
  ["Care Circle", careCircleSource],
  ["Birth Details", birthDetailsSource]
]) {
  assert.match(source, /import \{ SafeAreaView \} from "react-native-safe-area-context"/);
  assert.match(source, /<SafeAreaView edges=\{\["top", "left", "right", "bottom"\]\}/);
  assert.doesNotMatch(
    source,
    /import \{[^}]*SafeAreaView[^}]*\} from "react-native"/,
    `${name} must share the app's provider-backed safe-area geometry`
  );
  assert.match(
    source,
    /keyboardShouldPersistTaps="handled"/,
    `${name} must preserve form interaction while the keyboard is open`
  );
}
assert.match(
  homeScreenSource,
  /function WelcomeState[\s\S]*?<SafeAreaView edges=\{\["top", "bottom"\]\}/,
  "HOME-001 Welcome owns top + bottom insets for the header row and CTA"
);
assert.match(
  homeScreenSource,
  /export function LumisHomeScreen[\s\S]*?<SafeAreaView edges=\{\[\]\}/,
  "loaded Home must leave safe-area ownership to the persistent viewport and main tab bar"
);
assert.doesNotMatch(
  appSource,
  /import \{[^}]*SafeAreaView[^}]*\} from "react-native"/,
  "active App flows must not mix legacy and provider-backed safe-area geometry"
);
assert.match(appSource, /SafeAreaView as SafeAreaViewCtx/);
assert.match(
  appSource,
  /function ChartPreviewScreen[\s\S]*?<SafeAreaViewCtx edges=\{\["top", "left", "right", "bottom"\]\}/
);
assert.match(
  appSource,
  /function PastReflectionsScreen[\s\S]*?<SafeAreaViewCtx edges=\{\["bottom"\]\}/
);
assert.match(
  notificationCenterSource,
  /<SafeAreaView edges=\{\["top", "left", "right", "bottom"\]\}/
);
for (const [name, source] of [
  ["loaded Home", homeScreenSource],
  ["Insights", insightsSource],
  ["active chart and conversation flows", appSource],
  ["Notifications", notificationCenterSource]
]) {
  assert.match(
    source,
    /contentInsetAdjustmentBehavior="never"/,
    `${name} must not accept a delayed automatic iOS content inset`
  );
}
assert.doesNotMatch(
  authScreen,
  /useEffect\(\(\) => \{[\s\S]{0,180}setSentToEmail\(null\)/,
  "an async auth error cannot replace the inbox shell one frame after it mounts"
);
assert.match(authScreen, /<MagicLinkSentScreen[\s\S]{0,180}errorMessage=\{authError\}/);
assert.match(
  authSystemKit,
  /resendState === "error" \|\| errorMessage[\s\S]{0,240}accessibilityRole="alert"/,
  "callback errors must settle accessibly inside the existing inbox shell"
);
assert.ok(
  /setPendingChatDraft\(chatDraft\)/.test(appSource)
    || (
      /preserveApprovedDiceChatNavigation\(chatDraft\)/.test(appSource)
      && /setPendingChatDraft\(handoff\.chat_draft\)/.test(appSource)
      && /setScreen\(handoff\.target\)/.test(appSource)
    ),
  "Dice reflection must preserve the approved Chat draft and destination",
);
const personaAvatarSource = await readFile(
  path.join(root, "apps/mobile/src/components/LumisPersonaAvatar.tsx"),
  "utf8"
);
const birthProfileSource = await readFile(path.join(screensPath, "LumisBirthProfileScreen.tsx"), "utf8");
for (const requiredProfileSurface of [
  "YOUR CHART",
  "LUMIS PERSONA",
  "CARE CIRCLE",
  "PRIVACY & SUPPORT",
  "Delete account"
]) {
  assert.match(profileScreenSource, new RegExp(requiredProfileSurface));
}
assert.match(profileScreenSource, /Preview only\. Check-ins and carer links are not active yet\./);
assert.match(profileScreenSource, /label="Care Circle preview"/);
assert.match(profileScreenSource, /value="Not active yet"/);
assert.doesNotMatch(
  profileScreenSource,
  /<Switch|Enable check-in reminders|Check-in frequency|My check-in code|Add someone I care for|Manage linked Care Circle/
);
assert.match(appSource, /import \{ CareCirclePreviewScreen \}/);
assert.match(appSource, /<CareCirclePreviewScreen[\s\S]{0,120}onBack=/);
assert.doesNotMatch(appSource, /<CareCircleFlowScreen|<CareCircleScreen|eligible=\{/);
const careCirclePreview = extractRange(
  careCircleSource,
  "export function CareCirclePreviewScreen",
  "// Preserved prototype only."
);
assert.match(
  careCirclePreview,
  /Check-ins, linking, codes, and reminders are not active in this build\./
);
assert.doesNotMatch(
  careCirclePreview,
  /onCta|setView|simulateScan|sendRequest|setPaused|setCheckinOpen|setRemoveTarget/,
  "the reachable Care Circle preview cannot expose active relationship or check-in actions"
);
assert.doesNotMatch(
  careCircleSource,
  /export function CareCircle(?:Prototype)?Screen/,
  "the interactive Care Circle prototype must not be importable by release navigation"
);
const releaseNotifications = extractRange(
  notificationCenterSource,
  "export function NotificationCenterScreen",
  "// Preserved prototype only."
);
assert.match(releaseNotifications, /Preview · notifications are not active/);
assert.doesNotMatch(
  releaseNotifications,
  /Accept|Decline|carer_request|missed_checkin|resolve\(|deeplink/,
  "release notifications cannot expose Care Circle delivery or relationship actions"
);
// S1-C03 preview-safety: no Emergency contact row in the Profile Care Circle group.
assert.doesNotMatch(profileScreenSource, /Emergency contact/);
// S1-C03 preview-safety: Care Circle stays Preview-labelled on every route (the
// badge lives in the shared product frame), and the fixed four-digit sample
// control is DEV-only — never visible or callable in a release build.
assert.match(careCircleSource, /export function CareCircleProductFrame\(\{[\s\S]*?<PreviewBadge label="Preview · not active yet" \/>/);
assert.match(careCircleSource, /function Shell\(\{[\s\S]*?<CareCircleProductFrame/);
assert.match(careCircleSource, /function simulateScan\(code\?: string\) \{\s*if \(!__DEV__\) return;/);
assert.match(careCircleSource, /\{__DEV__ \? \(\s*<View style=\{s\.codeBox\}>/);
assert.match(careCircleSource, /\{__DEV__ \? \(\s*<>[\s\S]*?Use DEV sample/);
assert.doesNotMatch(careCircleSource, /LUMIS123|Simulate scan/);
assert.match(profileScreenSource, /showPendingNotice\("Account deletion"\)/);
assert.match(profileScreenSource, /will be connected after its security review is complete/);
assert.match(profileScreenSource, /value=\{formatMainFocus\(mainFocus\)\}/);
assert.match(profileScreenSource, /<LumisPersonaAvatar avatarKey=\{personaAvatarKey\} size=\{46\}/);
assert.match(appSource, /<LumisPersonaAvatar avatarKey=\{lumisAvatarKey\} size=\{38\}/);
assert.match(appSource, /lumisAvatarKey=\{personaAvatarKey\}/);
assert.match(appSource, /personaAvatarKey=\{personaAvatarKey\}/);
assert.match(personaAvatarSource, /PERSONA_AVATARS\.find\(\(option\) => option\.key === avatarKey\)/);
assert.match(personaAvatarSource, /accessibilityLabel=\{`\$\{avatar\.label\} Persona avatar`\}/);
assert.match(profileScreenSource, /function formatMainFocus/);
assert.doesNotMatch(profileScreenSource, /value="Personal growth"/);
assert.doesNotMatch(profileScreenSource, />Starter member</);
assert.match(
  accountStateSource,
  /select\("display_name, focus, persona_style, buddy_name, buddy_avatar_key"\)/
);
assert.match(accountStateSource, /select\("lang, language_preference_set_at"\)/);
assert.match(accountStateSource, /languageResult\.error\s*\?\s*null/);
assert.match(accountStateSource, /rpc\("resolve_active_plan_tier", \{ p_user_id: userId \}\)/);
assert.doesNotMatch(accountStateSource, /derivePlanTier|allocated, remaining/);
assert.match(profileScreenSource, /accessibilityLabel=\{value \? `\$\{label\}: \$\{value\}` : label\}/);
assert.match(birthProfileSource, /type BirthStep = "date" \| "time" \| "place"/);
assert.match(birthProfileSource, /badge="1 OF 3"/);
assert.match(birthProfileSource, /badge="2 OF 3"/);
assert.match(birthProfileSource, /badge="3 OF 3"/);
// ONB-003 signed-off unknown-time caveat (verbatim, non-paraphrasable per the
// implementation spec) — supersedes the earlier phrasing.
assert.match(birthProfileSource, /Rising sign \(Ascendant\), Midheaven \(MC\), or houses/);
assert.match(birthProfileSource, /PLACE_SUGGESTIONS/);
assert.match(birthProfileSource, /Create my chart/);
assert.match(birthProfileSource, /isValidBirthDate\(birthDate\.trim\(\), new Date\(\), runtimeTimeZone\(\)\)/);
assert.match(profileSource, /isValidBirthDate\(birthDate, new Date\(\), location\.timezone\)/);
assert.match(appSource, /function ChartGeneratingScreen/);
assert.match(appSource, /function ChartRevealScreen/);
assert.match(appSource, /function NatalChartWheel/);
assert.match(appSource, /this is your inner universe/);
// The reveal CTA label is parameterized (ctaLabel) so existing-user chart edits
// can relabel it ("Back to my Sky"); onboarding keeps the "Meet Lumis" default.
assert.match(appSource, /ctaLabel = "Meet Lumis"/);
assert.match(appSource, /\{ctaLabel\}/);
assert.match(appSource, /const ascendant = chart\.precision === "full" \? chart\.angles\.ascendant : undefined/);
assert.match(appSource, /Birth time unknown - planets shown without Ascendant, MC, houses, or planet house placements/);
assert.doesNotMatch(appSource, /function ChartRevealPanel/);
assert.match(appSource, /function PersonaStyleScreen/);
assert.match(appSource, /CHOOSE YOUR LUMIS PERSONA/);
assert.match(appSource, /How should Lumis show up for you/);
assert.match(appSource, /Enter your sanctuary/);
assert.match(appSource, /function PersonaRoleIcon/);
assert.match(appSource, /accessibilityRole="radio"[\s\S]{0,100}accessibilityState=\{\{ selected: isSelected \}\}/);
assert.match(appSource, /const totalMinutes = Math\.floor\(normalizedDegree \* 60\)/);
assert.doesNotMatch(appSource, /Math\.round\(placement\.degree\)/);
assert.match(appSource, /Give Lumis a face/);
assert.match(appSource, /PERSONA_AVATARS/);
assert.match(appSource, /CUSTOM NAME/);
assert.match(appSource, /WHAT SHOULD LUMIS HELP YOU FOCUS ON/);
assert.match(appSource, /savePersonaStylePreference\(personaStyle, identity\)/);
assert.match(profileSource, /rpc\("update_lumis_persona"/);
assert.match(profileSource, /p_buddy_avatar_key: identity\.avatarKey/);
assert.match(profileSource, /p_buddy_name: identity\.buddyName/);
assert.match(profileSource, /p_focus: identity\.mainFocus/);
assert.doesNotMatch(profileSource, /\.from\("users"\)[\s\S]{0,120}\.update\(/);
assert.match(accountStateSource, /buddyName: user\?\.buddy_name\?\.trim\(\) \|\| "Lumis"/);
// CHART-002 (8/8/2026 Founder brand fix): onboarding generation is an
// indeterminate loader — no client-timer step progression, no step checklist.
assert.match(appSource, /<GeneratingView\s+activeStep=\{0\}\s+indeterminate/);
assert.match(appSource, /title="Building your Lumis chart"/);
assert.match(generatingSource, /Aligning your ephemeris data/);
assert.match(generatingSource, /Positioning your Ascendant and angles/);
assert.match(generatingSource, /Turning your chart into personal algorithms/);
assert.match(generatingSource, /Preparing your first psychological insight/);
assert.doesNotMatch(appSource, /Preparing chart request/);
assertNoVisibleImplementationCopy(appSource, "App surfaces");
assertNoVisibleImplementationCopy(accountStateSource, "account restore messages");
assertNoVisibleImplementationCopy(authSource, "authentication messages");
assertNoVisibleImplementationCopy(profileSource, "chart profile messages");
assertNoVisibleImplementationCopy(chatSource, "chat messages");
for (const surface of scannedSurfaces) {
  assertNoRawJsxImplementationCopy(surface.source, surface.name);
}

console.log(`mobile UI contract checks passed across ${scannedSurfaces.length} non-billing surfaces`);

function extractFunction(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  assert.notEqual(start, -1, `${startName} must exist`);
  assert.notEqual(end, -1, `${endName} must exist after ${startName}`);
  return source.slice(start, end);
}

function extractRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + 1);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must exist after ${startMarker}`);
  return source.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(entryPath);
    return entry.name.endsWith(".tsx") ? [entryPath] : [];
  }));
  return files.flat();
}

function assertNoVisibleBilling(source, surface) {
  const visibleBillingStrings = [...source.matchAll(
    /["'`]([^"'`\n]*(?:\bcredits?\b|\bunits?\b|\bbilling\b|\bpaywall\b|\btop[- ]?up\b|\bpurchase\b|\bpayment\b|\binsufficient[- ]?credit\b|HK\$|\bcharged\b|\bcharging\b|\bcharge amount\b|\bprice\b|\bpricing\b|\bplans?\b|\bsubscriptions?\b|\bupgrade\b|\bspen(?:d|ding|t)\b)[^"'`\n]*)["'`]/gi
  )].map((match) => match[1]);

  assert.deepEqual(
    visibleBillingStrings,
    [],
    `${surface} contains billing language outside Profile/Paywall: ${visibleBillingStrings.join(" | ")}`
  );
}

async function assertScreenUsesTab(fileName, activeTab) {
  const source = await readFile(path.join(screensPath, fileName), "utf8");
  assert.match(
    source,
    new RegExp(`<MainTabBar active=["']${activeTab}["']`),
    `${fileName} must render the shared ${activeTab} tab state`
  );
}

function assertNoVisibleImplementationCopy(source, surface) {
  const visibleImplementationStrings = [...source.matchAll(
    /["'`]([^"'`\n]*(?:Supabase|local demo|API payload|Cloudflare|rawProviderResponse)[^"'`\n]*)["'`]/g
  )].map((match) => match[1]);

  assert.deepEqual(
    visibleImplementationStrings,
    [],
    `${surface} exposes implementation language: ${visibleImplementationStrings.join(" | ")}`
  );
}

function assertNoRawJsxImplementationCopy(source, surface) {
  const rawJsxMatches = [...source.matchAll(
    />\s*([^<{\n]*(?:Supabase|Cloudflare|local demo|API payload|scaffold)[^<{\n]*)\s*</gi
  )].map((match) => match[1].trim());

  assert.deepEqual(
    rawJsxMatches,
    [],
    `${surface} exposes raw JSX implementation language: ${rawJsxMatches.join(" | ")}`
  );
}
