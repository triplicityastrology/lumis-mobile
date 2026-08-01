import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const home = readFileSync("apps/mobile/src/screens/LumisHomeScreen.tsx", "utf8");

for (const styleName of [
  "personaIdentityPreview",
  "personaAvatarOption",
  "personaAvatarOptionActive",
  "personaNameInput",
  "personaChoiceCard",
  "personaChoiceCardActive"
]) {
  const block = styleBlock(app, styleName);
  assert.match(block, /backgroundColor: "#16273D"/);
}

for (const styleName of ["personaIdentityPreview", "personaAvatarOption", "personaNameInput", "personaChoiceCard"]) {
  assert.match(styleBlock(app, styleName), /borderWidth: 1/);
}
assert.match(styleBlock(app, "personaAvatarOptionActive"), /borderColor: "#DDB45E"/);
assert.match(styleBlock(app, "personaChoiceCardActive"), /borderColor: "#DDB45E"/);
assert.match(styleBlock(app, "personaIcon"), /backgroundColor: "rgba\(/);
assert.match(styleBlock(app, "personaIconActive"), /backgroundColor: "rgba\(/);

for (const styleName of ["chartCard", "reflectionCard"]) {
  const block = styleBlock(home, styleName);
  assert.match(block, /backgroundColor: colors\.surface/);
  assert.match(block, /borderWidth: 1/);
}
assert.match(styleBlock(home, "secondaryIcon"), /backgroundColor: "#1A3550"/);
assert.match(
  home,
  /<Pressable style=\{styles\.primaryAction\}[\s\S]{0,260}colors=\{\["#C9A96E", "#D7B978"\]\}[\s\S]{0,180}locations=\{\[0, 0\.6\]\}/
);
assert.match(styleBlock(home, "primaryAction"), /overflow: "hidden"/);
assert.doesNotMatch(styleBlock(home, "primaryAction"), /backgroundColor|opacity/);
assert.doesNotMatch(`${app}\n${home}`, /backdropFilter|BlurView/);

console.log("Name, Persona, and Restored Home surface contract passed");

function styleBlock(source, styleName) {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.notEqual(start, -1, `${styleName} must exist`);
  const multilineEnd = source.indexOf("\n  },", start);
  const singleLineEnd = source.indexOf(" },", start);
  const end = multilineEnd === -1 ? singleLineEnd : multilineEnd;
  assert.notEqual(end, -1, `${styleName} style must terminate`);
  return source.slice(start, end + 4);
}
