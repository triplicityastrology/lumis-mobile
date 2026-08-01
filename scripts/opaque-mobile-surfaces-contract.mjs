import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const home = readFileSync("apps/mobile/src/screens/LumisHomeScreen.tsx", "utf8");
const profile = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");

for (const styleName of [
  "personaChoiceCard",
  "personaIdentityPreview",
  "personaAvatarOption",
  "personaNameInput",
  "reflectionsEmpty",
  "reflectionsNoResults",
]) {
  const block = styleBlock(app, styleName);
  assert.match(block, /backgroundColor: "#(?:16273D|263958)"/);
  assert.match(block, /borderWidth: 1/);
  assert.doesNotMatch(block, /backgroundColor: "rgba\(/);
}

const reflectionsList = styleBlock(app, "reflectionsList");
assert.match(reflectionsList, /backgroundColor: "#16273D"/);
assert.match(reflectionsList, /borderWidth: 1/);
assert.match(reflectionsList, /overflow: "hidden"/);
assert.match(styleBlock(app, "reflectionThreadCard"), /backgroundColor: "transparent"/);
assert.match(styleBlock(app, "savedInsightsEmpty"), /backgroundColor: "#13233A"/);

for (const styleName of ["personaChoiceCardActive", "personaAvatarOptionActive"]) {
  const block = styleBlock(app, styleName);
  assert.match(block, /backgroundColor: "#[0-9A-F]{6}"/i);
  assert.doesNotMatch(block, /backgroundColor: "rgba\(/);
}

for (const styleName of ["chartCard", "reflectionCard"]) {
  const block = styleBlock(home, styleName);
  assert.match(block, /backgroundColor: colors\.surface/);
  assert.match(block, /borderWidth: 1/);
}

const profileRows = styleBlock(profile, "rows");
assert.match(profileRows, /backgroundColor: colors\.surface/);
assert.match(profileRows, /borderWidth: 1/);
assert.doesNotMatch(profileRows, /backgroundColor: "rgba\(/);

assert.doesNotMatch(`${app}\n${home}\n${profile}`, /backdropFilter|blurView|BlurView/);

console.log("five-screen opaque mobile surface contract passed");

function styleBlock(source, styleName) {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.notEqual(start, -1, `${styleName} must exist`);
  const multilineEnd = source.indexOf("\n  },", start);
  const singleLineEnd = source.indexOf(" },", start);
  const end = multilineEnd === -1 ? singleLineEnd : multilineEnd;
  assert.notEqual(end, -1, `${styleName} style must terminate`);
  return source.slice(start, end + 4);
}
