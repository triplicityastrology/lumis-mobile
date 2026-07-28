import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = read("apps/mobile/App.tsx");
const auth = read("apps/mobile/src/screens/LumisAuthScreen.tsx");
const authKit = read("apps/mobile/src/components/AuthSystemKit.tsx");
const flow = read("apps/mobile/src/components/FlowScreen.tsx");
const stateKit = read("apps/mobile/src/components/states/StateKit.tsx");
const onboarding = read("apps/mobile/src/screens/LumisBirthProfileScreen.tsx");
const birthDetails = read(
  "apps/mobile/src/features/birthDetails/BirthDetailsChangeScreen.tsx"
);
const care = read("apps/mobile/src/features/careCircle/CareCircleScreen.tsx");
const notifications = read(
  "apps/mobile/src/features/notifications/NotificationCenterScreen.tsx"
);
const dice = read("apps/mobile/src/screens/LumisDiceScreen.tsx");
const physicsDice = read(
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx"
);
const diceLayout = read(
  "apps/mobile/src/features/dice/useDiceResultActionLayout.ts"
);
const runbook = read("docs/qa/s2-t06-accessibility-device-readiness.md");

assert.match(flow, /accessibilityLabel="Back"[\s\S]{0,120}accessibilityRole="button"/);
assert.match(flow, /accessibilityRole="header" style=\{styles\.title\}/);
assert.match(stateKit, /accessibilityRole="header" style=\{k\.headerTitle\}/);

assert.match(auth, /accessibilityLabel="Email address"/);
assert.match(auth, /autoComplete="email"/);
assert.match(auth, /textContentType="emailAddress"/);
assert.match(auth, /returnKeyType="send"/);
assert.match(auth, /onSubmitEditing=\{\(\) => void sendLink\(\)\}/);
assert.match(auth, /accessibilityRole="alert"/);
assert.match(auth, /accessibilityLiveRegion="assertive"/);
assert.match(auth, /accessibilityLiveRegion="polite"[\s\S]{0,80}accessibilityRole="text"/);
assert.match(authKit, /accessibilityViewIsModal/);
assert.match(authKit, /accessibilityLabel="Cancel and stay signed in"/);
assert.match(authKit, /accessibilityState=\{\{ busy \}\}/);

assert.match(onboarding, /accessibilityRole="checkbox"/);
assert.match(onboarding, /accessibilityState=\{\{ checked: timeUnknown \}\}/);
assert.match(onboarding, /accessibilityRole="radio"/);
assert.match(onboarding, /accessibilityState=\{\{ selected \}\}/);
assert.equal((onboarding.match(/accessibilityRole="alert"/g) ?? []).length, 3);
assert.equal(
  (onboarding.match(/accessibilityLiveRegion="assertive"/g) ?? []).length,
  3
);

assert.match(birthDetails, /accessibilityRole="switch"/);
assert.match(
  birthDetails,
  /accessibilityState=\{\{ checked: draft\.timeUnknown \}\}/
);
assert.match(birthDetails, /accessibilityLabel="Confirm birth details regeneration"/);
assert.match(birthDetails, /accessibilityViewIsModal/);

assert.match(app, /if \(s === "auth"\)[\s\S]{0,120}accountReturn/);
assert.match(app, /if \(s === "persona"\)[\s\S]{0,120}personaReturn/);
assert.match(app, /if \(s === "preview"\) \{ setScreen\("profile"\); return true; \}/);
assert.match(app, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(app, /onBack=\{\(\) => setScreen\(personaReturn\)\}/);
assert.match(onboarding, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(birthDetails, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(dice, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(physicsDice, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(physicsDice, /if \(historyOpen\) setHistoryOpen\(false\)/);

assert.match(care, /Care Circle is a preview\./);
assert.match(care, /Check-ins, linking, codes, and reminders are not active in this build\./);
assert.match(care, /Preview · not active yet/);
assert.match(notifications, /Preview · notifications are not active/);
assert.match(notifications, /Notifications are a preview\./);
assert.match(stateKit, /accessible[\s\S]{0,100}accessibilityLabel=\{`\$\{title\}\. \$\{sub\}`\}/);

for (const source of [dice, physicsDice]) {
  assert.match(source, /accessibilityLabel="Dice question"/);
  assert.match(source, /Dice reading preview\./);
  assert.match(source, /Roll again/);
  assert.match(source, /Reflect in Chat/);
}
assert.match(dice, /accessibilityRole="button"[\s\S]{0,160}onPress=\{reset\}/);
assert.match(dice, /accessibilityRole="button"[\s\S]{0,160}onPress=\{\(\) => onReflect/);
assert.match(diceLayout, /PixelRatio\.getFontScale\(\)/);
assert.match(diceLayout, /Dimensions\.addEventListener\("change"/);
assert.match(diceLayout, /AppState\.addEventListener\("change"/);
assert.match(diceLayout, /state === "active"/);
assert.match(diceLayout, /effectiveFontScale >= LARGE_TEXT_RESULT_ACTION_SCALE/);

for (const phrase of [
  "No device evidence is claimed",
  "VoiceOver",
  "TalkBack",
  "Android hardware Back",
  "largest accessibility text",
  "onboarding",
  "Care Circle",
  "Notifications"
]) {
  assert.match(runbook, new RegExp(escapeRegExp(phrase), "i"));
}

console.log("Sprint 2 accessibility/device-readiness source contracts passed");

function read(file) {
  return readFileSync(file, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
