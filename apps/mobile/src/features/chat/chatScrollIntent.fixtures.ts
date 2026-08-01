import {
  isNearChatLatest,
  shouldMaintainChatLatest,
  type ChatContentChange,
} from "./chatScrollIntent";

equal(
  isNearChatLatest({ contentHeight: 2400, viewportHeight: 700, offsetY: 1640 }),
  true,
  "long conversation within 60px follows latest"
);
equal(
  isNearChatLatest({ contentHeight: 2400, viewportHeight: 700, offsetY: 1500 }),
  false,
  "deliberate upward scroll does not follow latest"
);

for (const change of [
  "message_sent",
  "reply_pending",
  "reply_completed",
  "composer_layout",
] satisfies ChatContentChange[]) {
  equal(shouldMaintainChatLatest(true, change), true, `${change} stays anchored`);
  equal(shouldMaintainChatLatest(false, change), false, `${change} respects reader position`);
}

equal(
  isNearChatLatest({ contentHeight: 620, viewportHeight: 700, offsetY: 0 }),
  true,
  "short conversation remains anchored"
);

console.log("chat bottom anchoring fixtures passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
