import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const avatar = readFileSync(
  "apps/mobile/src/components/LumisPersonaAvatar.tsx",
  "utf8"
);

assert.match(app, /function LumisChatAvatar\(\{ avatarKey \}/);
assert.match(
  app,
  /function LumisChatAvatar[\s\S]{0,240}<LumisPersonaAvatar avatarKey=\{avatarKey\} size=\{26\}/
);
assert.match(
  app,
  /chatAvatar[\s\S]{0,180}<LumisPersonaAvatar avatarKey=\{lumisAvatarKey\} size=\{38\}/
);
assert.equal(
  (app.match(/<LumisChatAvatar avatarKey=\{lumisAvatarKey\} \/>/g) ?? []).length,
  3,
  "intro, completed, and pending assistant rows must share the canonical avatar"
);
assert.doesNotMatch(app, /function PersonaChatMarker|Lumis marker/);
assert.match(avatar, /accessibilityLabel=\{`\$\{avatar\.label\} Persona avatar`\}/);
assert.match(avatar, /<Circle[\s\S]*fill=\{avatar\.color\}/);
assert.match(avatar, /<SvgText[\s\S]*\{avatar\.glyph\}/);

console.log("canonical Chat assistant identity contract passed");
