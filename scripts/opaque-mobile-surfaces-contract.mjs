import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const home = readFileSync("apps/mobile/src/screens/LumisHomeScreen.tsx", "utf8");
const profile = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const frosted = readFileSync("apps/mobile/src/components/FrostedCard.tsx", "utf8");

// Founder branding fix (1/8/2026, RULE 1): the seven branded screens now use
// genuine frosted glass (translucent navy + native BlurView) so the sky hints
// through — NOT solid navy. Surfaces on screens outside that batch (persona /
// onboarding choice cards, and the empty/no-results states) remain opaque so
// text can never bleed through them.

// 1. Surfaces that intentionally STAY opaque (not in the branding batch).
for (const styleName of [
  "personaChoiceCard",
  "personaIdentityPreview",
  "personaAvatarOption",
  "personaNameInput",
  "reflectionsEmpty",
  "reflectionsNoResults",
]) {
  const block = styleBlock(app, styleName);
  assert.match(block, /backgroundColor: "#16273D"/, `${styleName} stays opaque`);
  assert.match(block, /borderWidth: 1/);
  assert.doesNotMatch(block, /backgroundColor: "rgba\(/);
}
for (const styleName of ["personaChoiceCardActive", "personaAvatarOptionActive"]) {
  const block = styleBlock(app, styleName);
  assert.match(block, /backgroundColor: "#16273D"/);
  assert.doesNotMatch(block, /backgroundColor: "rgba\(/);
}

// 2. The anti-bleed-through mechanism is now the shared FrostedCard primitive:
//    a native BlurView under a translucent navy overlay. This is what keeps the
//    branded translucent cards from letting text/stars bleed through.
assert.match(frosted, /from "expo-blur"/, "FrostedCard uses the native blur dependency");
assert.match(frosted, /<BlurView\b/, "FrostedCard layers a real BlurView");
assert.match(frosted, /rgba\(22,39,61,0\.55\)/, "FrostedCard primary overlay is 55% navy");

// 3. Branded surfaces delegate their fill to FrostedCard (transparent style +
//    FrostedCard wrapper), never a solid navy fill.
assert.match(styleBlock(app, "reflectionsList"), /backgroundColor: "transparent"/);
assert.match(styleBlock(app, "reflectionThreadCard"), /backgroundColor: "transparent"/);
assert.match(styleBlock(app, "savedInsightsEmpty"), /backgroundColor: "transparent"/);
assert.match(app, /<FrostedCard style=\{styles\.reflectionsList\}/, "REFL list is frosted");
assert.match(app, /<FrostedCard style=\{styles\.savedInsightsEmpty\}/, "Saved Insights note is frosted");

for (const styleName of ["chartCard", "reflectionCard"]) {
  assert.doesNotMatch(styleBlock(home, styleName), /backgroundColor: colors\.surface/);
}
assert.match(home, /<FrostedCard style=\{styles\.chartCard\}/, "HOME chart card is frosted");
assert.match(home, /<FrostedCard style=\{styles\.reflectionCard\}/, "HOME Past Reflections card is frosted");

assert.match(styleBlock(profile, "rows"), /backgroundColor: "transparent"/);
assert.match(profile, /<FrostedCard style=\{styles\.rows\}/, "Profile groups are frosted");

console.log("mobile surface treatment contract passed (opaque unbranded + frosted branded)");

function styleBlock(source, styleName) {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.notEqual(start, -1, `${styleName} must exist`);
  const multilineEnd = source.indexOf("\n  },", start);
  const singleLineEnd = source.indexOf(" },", start);
  const end = multilineEnd === -1 ? singleLineEnd : multilineEnd;
  assert.notEqual(end, -1, `${styleName} style must terminate`);
  return source.slice(start, end + 4);
}
