import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const indicator = readFileSync(
  "apps/mobile/src/components/ChatThinkingIndicator.tsx",
  "utf8"
);

assert.match(app, /import \{ ChatThinkingIndicator \}/);
const pendingStart = app.indexOf("isSending && !turn.result && !turn.error");
const pendingEnd = app.indexOf("{turn.error ?", pendingStart);
assert.notEqual(pendingStart, -1);
assert.notEqual(pendingEnd, -1);
const pendingReplyView = app.slice(pendingStart, pendingEnd);
assert.match(pendingReplyView, /<ChatThinkingIndicator\s*\/>/);
assert.doesNotMatch(pendingReplyView, /ChatThinkingIndicator[^>]*color=/);
assert.match(pendingReplyView, />Reflecting\.\.\.<\/Text>/);
assert.match(indicator, /AccessibilityInfo\.isReduceMotionEnabled/);
assert.match(indicator, /const DEFAULT_GOLD = "#E8C98D"/);
assert.match(indicator, /export function ChatThinkingIndicator\(\)/);
assert.equal(
  (indicator.match(/color=\{DEFAULT_GOLD\}/g) ?? []).length,
  3,
  "all orbit sparks must use the fixed gold"
);
assert.match(indicator, /backgroundColor: DEFAULT_GOLD/);
assert.match(indicator, /shadowColor: DEFAULT_GOLD/);
assert.doesNotMatch(indicator, /\{ color\??|color = DEFAULT_GOLD/);
assert.match(indicator, /"reduceMotionChanged"/);
assert.match(indicator, /duration: 2200|duration: 1100/);
assert.match(indicator, /duration: 2400/);
assert.match(indicator, /Easing\.linear/);
assert.match(indicator, /angle="0deg"[^>]*opacity=\{1\}/);
assert.match(indicator, /angle="120deg"[^>]*opacity=\{0\.72\}/);
assert.match(indicator, /angle="240deg"[^>]*opacity=\{0\.48\}/);
assert.match(indicator, /if \(reduceMotion\)[\s\S]{0,140}orbit\.setValue\(0\)/);
assert.doesNotMatch(indicator, /setTimeout|setInterval|fetch\s*\(|sendChatMessage/);
assert.doesNotMatch(pendingReplyView, /sendChatMessage|setTimeout|setInterval/);

console.log("chat thinking loader visual contract passed");
