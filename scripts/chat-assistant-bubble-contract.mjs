import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const chatStart = app.indexOf("function ChatShellScreen");
const stylesStart = app.indexOf("const styles = StyleSheet.create");
const chat = app.slice(chatStart, stylesStart);

assert.ok(chatStart >= 0 && stylesStart > chatStart);
assert.equal(
  (chat.match(/styles\.messageBubbleLumisSubtle/g) ?? []).length,
  3,
  "greeting, completed reply, and pending reply must share the subtle Lumis surface"
);
assert.match(
  app,
  /messageBubbleLumisSubtle:\s*\{[\s\S]{0,140}backgroundColor: "rgba\(22,39,61,0\.10\)"[\s\S]{0,100}borderColor: "rgba\(215,185,120,0\.28\)"/
);
assert.match(
  app,
  /messageBubbleUser:\s*\{[\s\S]{0,180}backgroundColor: "rgba\(139,147,212,0\.26\)"[\s\S]{0,100}borderColor: "rgba\(206,216,255,0\.14\)"/
);

const pendingStart = chat.indexOf("isSending && !turn.result && !turn.error");
const pendingEnd = chat.indexOf("{turn.error ?", pendingStart);
const pending = chat.slice(pendingStart, pendingEnd);
assert.match(pending, /messageBubbleLumisSubtle/);
assert.match(pending, /<ChatThinkingIndicator\s*\/>/);
assert.doesNotMatch(app, /#F5EBD8|#D8BD84|messageBubbleLumisCompleted|messageTextLumisCompleted/);
assert.doesNotMatch(chat, /backgroundColor:\s*"(?:#F[0-9A-F]{5}|#D7B978|#C9A96E)"/i);
assert.match(chat, /styles\.chatTransitTag/);
assert.match(app, /chatTransitTagText:\s*\{[\s\S]{0,100}color: "#E9B083"/);

console.log("completed Chat assistant bubble differentiation contract passed");
