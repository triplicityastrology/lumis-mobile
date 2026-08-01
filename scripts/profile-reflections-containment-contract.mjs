import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const profile = readFileSync(
  "apps/mobile/src/screens/LumisProfileScreen.tsx",
  "utf8"
);

// RULE 1: profile groups are frosted glass (fill/clip via FrostedCard); rows stay
// transparent inside, and the note renders below the group in normal flow.
assert.match(styleBlock(profile, "rows"), /backgroundColor: "transparent"/);
assert.match(profile, /<FrostedCard style=\{styles\.rows\} radius=\{18\}>/);
assert.match(styleBlock(profile, "row"), /backgroundColor: "transparent"/);
assert.match(
  profile,
  /<FrostedCard style=\{styles\.rows\}[\s\S]*?<\/FrostedCard>\s*\{note \? <Text style=\{styles\.sectionNote\}>\{note\}<\/Text>/
);
assert.doesNotMatch(styleBlock(profile, "sectionNote"), /position: "absolute"|zIndex/);

// REFL list is one frosted wrapper; rows stay transparent inside it.
assert.match(styleBlock(app, "reflectionsList"), /backgroundColor: "transparent"/);
assert.match(app, /<FrostedCard style=\{styles\.reflectionsList\} radius=\{16\}>/);
assert.match(styleBlock(app, "reflectionThreadCard"), /backgroundColor: "transparent"/);
assert.doesNotMatch(styleBlock(app, "reflectionThreadCard"), /borderRadius|borderWidth/);
assert.match(styleBlock(app, "reflectionThreadCardDivided"), /rgba\(255,255,255,0\.05\)/);
assert.match(styleBlock(app, "savedInsightsEmpty"), /backgroundColor: "transparent"/);
assert.match(styleBlock(app, "reflectionsSearch"), /backgroundColor: "transparent"/);
assert.match(
  app,
  /<FrostedCard style=\{styles\.reflectionsList\}[\s\S]{0,900}styles\.reflectionThreadCardDivided/
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
