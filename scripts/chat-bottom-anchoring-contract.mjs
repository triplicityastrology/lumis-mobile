import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("apps/mobile/App.tsx", "utf8");
const intent = readFileSync(
  "apps/mobile/src/features/chat/chatScrollIntent.ts",
  "utf8"
);

assert.match(app, /const chatScrollRef = useRef<ScrollView>/);
assert.match(app, /const isFollowingChatLatestRef = useRef\(true\)/);
assert.match(app, /isNearChatLatest\(\{/);
assert.match(app, /onScroll=\{handleChatScroll\}/);
assert.match(app, /onContentSizeChange=\{\(\) => maintainChatLatest\("reply_completed"\)\}/);
assert.match(app, /shouldMaintainChatLatest\(isFollowingChatLatestRef\.current/);
assert.match(app, /accessibilityLabel="Return to latest message"/);
assert.match(app, />Latest<\/Text>/);
assert.doesNotMatch(app, /onScroll=\{[^}]*scrollToEnd/);
assert.match(intent, /CHAT_LATEST_THRESHOLD_PX = 80/);
assert.match(intent, /"message_sent"/);
assert.match(intent, /"reply_pending"/);
assert.match(intent, /"reply_completed"/);
assert.match(intent, /"composer_layout"/);

console.log("chat bottom anchoring contract passed");
