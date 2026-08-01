import assert from "node:assert/strict";

import { applyConfirmedReflectionDeletion } from "./reflectionDeletionState";

const threads = [{ id: "reflection-a" }, { id: "reflection-b" }];
const turns = [{ id: "turn-a" }];
const activeDeleted = applyConfirmedReflectionDeletion({
  source: "supabase",
  deletedThreadId: "reflection-a",
  reflectionThreads: threads,
  threadId: (thread) => thread.id,
  activeThreadId: "reflection-a",
  chatTurns: turns
});
assert.deepEqual(activeDeleted, {
  reflectionThreads: [{ id: "reflection-b" }],
  activeThreadId: null,
  chatTurns: [],
  forceNewThread: true
});

const inactiveDeleted = applyConfirmedReflectionDeletion({
  source: "supabase",
  deletedThreadId: "reflection-b",
  reflectionThreads: threads,
  threadId: (thread) => thread.id,
  activeThreadId: "reflection-a",
  chatTurns: turns
});
assert.deepEqual(inactiveDeleted, {
  reflectionThreads: [{ id: "reflection-a" }],
  activeThreadId: "reflection-a",
  chatTurns: turns,
  forceNewThread: false
});

const localDeleted = applyConfirmedReflectionDeletion({
  source: "local_demo",
  deletedThreadId: "local-reflection",
  reflectionThreads: [],
  threadId: (thread: { id: string }) => thread.id,
  activeThreadId: null,
  chatTurns: turns
});
assert.deepEqual(localDeleted.chatTurns, []);
assert.equal(localDeleted.forceNewThread, false);
