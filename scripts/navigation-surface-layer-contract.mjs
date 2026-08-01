import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tabs = readFileSync("apps/mobile/src/components/MainTabBar.tsx", "utf8");
const home = readFileSync("apps/mobile/src/screens/LumisHomeScreen.tsx", "utf8");
const profile = readFileSync("apps/mobile/src/screens/LumisProfileScreen.tsx", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");

const tabSurface = styleBlock(tabs, "tabs");
assert.match(tabSurface, /backgroundColor: colors\.navy950/);
assert.doesNotMatch(tabSurface, /backgroundColor: ["']rgba\(/);
assert.match(tabSurface, /borderTopWidth: 1/);
assert.match(tabSurface, /position: "relative"/);
assert.match(tabSurface, /zIndex: 20/);
assert.match(tabSurface, /elevation: 8/);
assert.match(tabSurface, /minHeight: 58/);

assert.match(tabs, /Math\.max\(insets\.bottom, 8\)/);
assert.match(tabs, /accessibilityRole="tablist"/);
assert.match(tabs, /accessibilityState=\{\{ selected \}\}/);
for (const label of ["Talk", "Insights", "Dice", "You"]) {
  assert.match(tabs, new RegExp(`label: "${label}"`));
}

assert.match(home, /<MainTabBar[\s\S]{0,260}active="chat"/);
assert.match(profile, /<MainTabBar active="profile"/);
assert.match(app, /function PastReflectionsScreen/);
assert.doesNotMatch(app, /function PastReflectionsScreen[\s\S]*?<MainTabBar/);

console.log("opaque bottom-navigation surface and layer contract passed");

function styleBlock(source, styleName) {
  const start = source.indexOf(`  ${styleName}: {`);
  assert.notEqual(start, -1);
  const end = source.indexOf("\n  },", start);
  assert.notEqual(end, -1);
  return source.slice(start, end + 5);
}
