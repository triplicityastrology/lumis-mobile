import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const chatStart = app.indexOf("function ChatShellScreen");
const stylesStart = app.indexOf("const styles = StyleSheet.create");
const chat = app.slice(chatStart, stylesStart);

assert.ok(chatStart >= 0 && stylesStart > chatStart);
assert.equal(
  (chat.match(/styles\.messageBubbleLumisCompleted/g) ?? []).length,
  2,
  "greeting and completed reply must use the completed assistant surface"
);
assert.equal(
  (chat.match(/styles\.messageTextLumisCompleted/g) ?? []).length,
  2,
  "greeting and completed reply must use dark readable text"
);
assert.match(
  app,
  /messageBubbleLumisCompleted:\s*\{[\s\S]{0,120}backgroundColor: "#F5EBD8"[\s\S]{0,80}borderColor: "#D8BD84"/
);
assert.match(
  app,
  /messageTextLumisCompleted:\s*\{[\s\S]{0,120}color: "#202A3D"/
);
assert.match(
  app,
  /messageBubbleUser:\s*\{[\s\S]{0,180}backgroundColor: "rgba\(139,147,212,0\.26\)"[\s\S]{0,100}borderColor: "rgba\(206,216,255,0\.14\)"/
);

const pendingStart = chat.indexOf("isSending && !turn.result && !turn.error");
const pendingEnd = chat.indexOf("{turn.error ?", pendingStart);
const pending = chat.slice(pendingStart, pendingEnd);
assert.doesNotMatch(pending, /messageBubbleLumisCompleted|messageTextLumisCompleted/);
assert.match(pending, /personaTreatment\.bubbleBackgroundColor/);
assert.match(pending, /personaTreatment\.bubbleBorderColor/);
assert.match(chat, /styles\.chatTransitTag/);
assert.match(app, /chatTransitTagText:\s*\{[\s\S]{0,100}color: "#E9B083"/);

console.log("completed Chat assistant bubble differentiation contract passed");
