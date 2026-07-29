import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("apps/mobile/App.tsx", "utf8");
const dice = await readFile("apps/mobile/src/features/dice/DiceRitualScreen.tsx", "utf8");
const diceHistory = await readFile("apps/mobile/src/features/dice/DiceHistorySheet.tsx", "utf8");
const navigationAuthority = await readFile(
  "docs/architecture/navigation-back-context.md",
  "utf8"
);

for (const state of [
  'reflectionsReturn, setReflectionsReturn] = useState<"home" | "chat">("home")',
  'accountReturn, setAccountReturn] = useState<"home" | "profileTab">("home")',
  'personaReturn, setPersonaReturn] = useState<"preview" | "profileTab">("preview")'
]) {
  assert.match(app, new RegExp(escapeRegExp(state)));
}

assert.match(app, /onPastReflections=\{\(\) => openPastReflections\("chat"\)\}/);
assert.match(
  app,
  /if \(screen === "reflections"\)[\s\S]{0,420}onBack=\{\(\) => setScreen\(reflectionsReturn\)\}/
);
assert.match(
  app,
  /onPastReflections=\{async \(\) => \{\s*setReflectionsReturn\("home"\)/
);
assert.match(app, /onAccount=\{openAccountEntry\}/);
assert.match(
  app,
  /function openAccountEntry\(\) \{\s*setAccountReturn\(screenRef\.current === "profileTab" \? "profileTab" : "home"\)/
);
assert.match(
  app,
  /if \(screen === "auth"\)[\s\S]{0,260}onBack=\{\(\) => setScreen\(accountReturn\)\}/
);
assert.match(app, /onPersona=\{\(\) => openPersona\("profileTab"\)\}/);
assert.match(
  app,
  /if \(screen === "persona"[\s\S]{0,360}onBack=\{\(\) => setScreen\(personaReturn\)\}/
);

assert.match(
  app,
  /if \(screen === "notifications"\)[\s\S]{0,220}onBack=\{\(\) => setScreen\(notificationsReturn\)\}/
);
assert.match(
  app,
  /function openNotifications\(\)[\s\S]{0,360}setNotificationsReturn\(screen\)[\s\S]{0,160}setScreen\("notifications"\)/
);
assert.match(app, /onNotifications=\{openNotifications\}/);
assert.match(app, /onCareCircle=\{\(\) => setScreen\("care"\)\}/);
assert.match(app, /onBirthDetails=\{\(\) => setScreen\("birthDetails"\)\}/);
assert.match(app, /onBack=\{\(\) => setScreen\("profileTab"\)\}/);
assert.ok(
  (app.match(/onBack=\{\(\) => setScreen\("profileTab"\)\}/g) ?? []).length >= 3,
  "Care Circle, Birth Details, and updated-chart subflows must return to Profile"
);
assert.match(
  app,
  /if \(screen === "profile"\)[\s\S]{0,220}onBack=\{\(\) => setScreen\("home"\)\}/
);
assert.match(
  app,
  /if \(screen === "preview"[\s\S]{0,220}onBack=\{\(\) => setScreen\("profile"\)\}/
);
assert.match(
  app,
  /<RestoringSpaceScreen[\s\S]{0,260}onBack=\{openAccountRecovery\}/
);
assert.match(
  app,
  /function openAccountRecovery\(\)[\s\S]{0,300}setScreen\("auth"\)/
);
assert.doesNotMatch(
  app.match(/function openAccountRecovery\(\)[\s\S]*?function applySupabaseAccountState/)?.[0] ?? "",
  /clearVisibleAccountState|loadLocalDemoSession|setScreen\("noChart"\)/,
  "failed restore Back must preserve the signed-in account and avoid demo/onboarding routes"
);

assert.match(dice, /setHistoryOpen\(true\)/);
assert.match(dice, /<DiceHistorySheet onClose=\{\(\) => setHistoryOpen\(false\)\}/);
assert.match(
  dice,
  /if \(phase === "IDLE"\) \{\s*onBack\(\);\s*\} else \{\s*rethrow\(\);/,
  "Dice result and ritual subflows must reset to Dice before leaving the tab"
);
assert.match(diceHistory, /accessibilityLabel="Close history" onPress=\{onClose\}/);
assert.match(diceHistory, /accessibilityLabel="Close" onPress=\{onClose\}/);

const tabSelection = extractRange(
  app,
  "function openMainTab",
  "// Android hardware back"
);
assert.doesNotMatch(
  tabSelection,
  /set(?:Account|Notifications|Persona|Reflections)Return/,
  "ordinary bottom-tab selection cannot alter Back context"
);

const hardwareBack = extractRange(
  app,
  "const onHardwareBack = () =>",
  "const sub = BackHandler.addEventListener"
);
for (const returnRule of [
  'if (s === "notifications") { setScreen(notificationsReturn); return true; }',
  'if (s === "reflections") { setScreen(reflectionsReturn); return true; }',
  'if (s === "auth") { setScreen(accountReturn); return true; }',
  'if (s === "persona") { setScreen(personaReturn); return true; }'
]) {
  assert.match(hardwareBack, new RegExp(escapeRegExp(returnRule)));
}

assert.match(navigationAuthority, /immediately preceding in-app screen or context/i);
assert.match(navigationAuthority, /Bottom-tab selection does not add to this Back history/i);
assert.match(navigationAuthority, /direct or deep entry falls back to Home/i);

console.log("navigation Back-context contract checks passed");

function extractRange(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
