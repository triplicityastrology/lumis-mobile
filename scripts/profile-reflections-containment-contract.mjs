import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const profile = readFileSync(
  "apps/mobile/src/screens/LumisProfileScreen.tsx",
  "utf8"
);

const profileRows = styleBlock(profile, "rows");
assert.match(profileRows, /backgroundColor: colors\.surface/);
assert.match(profileRows, /borderWidth: 1/);
assert.match(profileRows, /overflow: "hidden"/);
assert.match(styleBlock(profile, "row"), /backgroundColor: "transparent"/);
// The group's rows render inside the opaque `styles.rows` wrapper, and the note
// (helper/disclaimer text) renders directly after it in normal layout flow — so
// it sits below the group and never ghosts through the card.
assert.match(
  profile,
  /<View style=\{styles\.rows\}>[\s\S]*?<\/View>\s*\{note \? <Text style=\{styles\.sectionNote\}>\{note\}<\/Text>/
);
assert.doesNotMatch(styleBlock(profile, "sectionNote"), /position: "absolute"|zIndex/);

const list = styleBlock(app, "reflectionsList");
assert.match(list, /backgroundColor: "#16273D"/);
assert.match(list, /borderWidth: 1/);
assert.match(list, /overflow: "hidden"/);
assert.match(styleBlock(app, "reflectionThreadCard"), /backgroundColor: "transparent"/);
assert.doesNotMatch(styleBlock(app, "reflectionThreadCard"), /borderRadius|borderWidth/);
assert.match(styleBlock(app, "reflectionThreadCardDivided"), /rgba\(255,255,255,0\.05\)/);
assert.match(styleBlock(app, "savedInsightsEmpty"), /backgroundColor: "#13233A"/);
assert.match(styleBlock(app, "reflectionsSearch"), /backgroundColor: "transparent"/);
assert.match(
  app,
  /<View style=\{styles\.reflectionsList\}>[\s\S]{0,800}styles\.reflectionThreadCardDivided/
);

console.log("Profile and Past Reflections containment contract passed");

function styleBlock(source, styleName) {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.notEqual(start, -1, `${styleName} must exist`);
  const multilineEnd = source.indexOf("\n  },", start);
  const singleLineEnd = source.indexOf(" },", start);
  const end = multilineEnd === -1 ? singleLineEnd : multilineEnd;
  assert.notEqual(end, -1, `${styleName} style must terminate`);
  return source.slice(start, end + 4);
}
