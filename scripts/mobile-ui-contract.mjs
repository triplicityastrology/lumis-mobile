import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "apps/mobile/App.tsx");
const screensPath = path.join(root, "apps/mobile/src/screens");
const mainTabBarPath = path.join(root, "apps/mobile/src/components/MainTabBar.tsx");
const appSource = await readFile(appPath, "utf8");
const mainTabBarSource = await readFile(mainTabBarPath, "utf8");
const accountStateSource = await readFile(path.join(root, "apps/mobile/src/services/accountState.ts"), "utf8");
const authSource = await readFile(path.join(root, "apps/mobile/src/services/auth.ts"), "utf8");
const profileSource = await readFile(path.join(root, "apps/mobile/src/services/profile.ts"), "utf8");
const chatSource = await readFile(path.join(root, "apps/mobile/src/services/chat.ts"), "utf8");
const paywallSource = extractFunction(appSource, "PlansAccessScreen", "BirthDetailsScreen");
const nonPaywallAppSource = appSource.replace(paywallSource, "");
const screenFiles = (await readdir(screensPath))
  .filter((name) => name.endsWith(".tsx") && !/profile|paywall/i.test(name))
  .map((name) => path.join(screensPath, name));

const scannedSurfaces = [
  { name: "App surfaces outside Paywall", source: nonPaywallAppSource },
  ...await Promise.all(screenFiles.map(async (file) => ({
    name: path.relative(root, file),
    source: await readFile(file, "utf8")
  })))
];

for (const surface of scannedSurfaces) {
  assertNoVisibleBilling(surface.source, surface.name);
}

assert.match(paywallSource, /credits/i, "Paywall must retain credit information");
assert.doesNotMatch(appSource, /accessibilityLabel="Credit estimate"/i);
assert.doesNotMatch(appSource, /test mode:\s*no charge/i);
assert.match(mainTabBarSource, /label: "Talk"/);
assert.match(mainTabBarSource, /label: "Insights"/);
assert.match(mainTabBarSource, /label: "Dice"/);
assert.match(mainTabBarSource, /label: "You"/);
assert.match(appSource, /<MainTabBar active="chat"/);
assert.match(appSource, /restoreAccountForStatus\(status, true\)/);
assert.match(appSource, /if \(restored && routeLoadedAccount\)[\s\S]{0,120}setScreen\("chat"\)/);
assert.match(appSource, /accessibilityLabel="Past Reflections"/);
assert.match(appSource, /placeholder="Search reflections"/);
assert.match(appSource, /Start a new topic/);
assert.match(appSource, /Continue reflection/);
assert.match(appSource, /Read reflection/);
assert.match(appSource, /SAVED INSIGHTS/);
assert.match(appSource, /const filteredThreads = normalizedQuery/);
assert.match(appSource, /No matching reflections/);
assert.match(appSource, /onNotifications=\{\(\) => setScreen\("notifications"\)\}/);
assert.match(appSource, /<Bell[^>]+size=\{18\}/);
await assertScreenUsesTab("ChartInsightsScreen.tsx", "insights");
await assertScreenUsesTab("LumisDiceScreen.tsx", "dice");
await assertScreenUsesTab("LumisProfileScreen.tsx", "profile");
const insightsSource = await readFile(path.join(screensPath, "ChartInsightsScreen.tsx"), "utf8");
assert.match(insightsSource, /accessibilityLabel="Notifications"/);
const diceSource = await readFile(path.join(screensPath, "LumisDiceScreen.tsx"), "utf8");
assert.match(diceSource, /type DiceStep = "ask" \| "shake" \| "result"/);
assert.match(diceSource, /Accelerometer\.addListener/);
assert.match(diceSource, /<OctaDie/);
assert.match(diceSource, /Save this reflection/);
assert.match(diceSource, /function cancelRoll\(\)[\s\S]{0,160}clearRollTimers\(\)/);
assert.match(diceSource, /onPress=\{step === "result" \? reset : cancelRoll\}/);
assert.match(appSource, /setPendingChatDraft\(chatDraft\)/);
const profileScreenSource = await readFile(path.join(screensPath, "LumisProfileScreen.tsx"), "utf8");
for (const requiredProfileSurface of [
  "YOUR CHART",
  "LUMIS PERSONA",
  "PLAN",
  "CARE CIRCLE",
  "PRIVACY & SUPPORT",
  "Export my data",
  "Delete account"
]) {
  assert.match(profileScreenSource, new RegExp(requiredProfileSurface));
}
assert.match(profileScreenSource, /Preview only\. Check-ins and carer links are not active yet\./);
assert.match(profileScreenSource, /showPendingNotice\("Account deletion"\)/);
assert.match(profileScreenSource, /will be connected after its security review is complete/);
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

function assertNoVisibleBilling(source, surface) {
  const visibleBillingStrings = [...source.matchAll(
    /["'`]([^"'`\n]*(?:\bcredits?\b|\bbilling\b|test mode|no charge)[^"'`\n]*)["'`]/gi
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
