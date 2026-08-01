import assert from "node:assert/strict";

import { deleteReflectionWithPort } from "./reflectionDeletionBoundary";

const input = {
  threadId: "11111111-1111-4111-8111-111111111111",
  clientRequestId: "22222222-2222-4222-8222-222222222222"
};

async function run() {
assert.deepEqual(await deleteReflectionWithPort(async () => ({ data: "deleted", error: null }), input), {
  ok: true,
  status: "deleted"
});
assert.deepEqual(await deleteReflectionWithPort(async () => ({ data: "already_deleted", error: null }), input), {
  ok: true,
  status: "already_deleted"
});
assert.deepEqual(await deleteReflectionWithPort(async () => ({ data: null, error: { code: "P0002" } }), input), {
  ok: false,
  code: "NOT_FOUND"
});
let failureAttempts = 0;
const failedOnce = async () => {
  failureAttempts += 1;
  if (failureAttempts === 1) throw new Error("private transport detail");
  return { data: "deleted", error: null };
};
assert.deepEqual(await deleteReflectionWithPort(failedOnce, input), { ok: false, code: "TEMPORARILY_UNAVAILABLE" });
assert.deepEqual(await deleteReflectionWithPort(failedOnce, input), { ok: true, status: "deleted" });
assert.equal(failureAttempts, 2);
assert.deepEqual(await deleteReflectionWithPort(async () => {
  throw new Error("private transport detail");
}, input), { ok: false, code: "TEMPORARILY_UNAVAILABLE" });
assert.deepEqual(await deleteReflectionWithPort(async () => ({ data: "deleted", error: null }), {
  ...input,
  threadId: "another-user-thread"
}), { ok: false, code: "NOT_FOUND" });

}

void run();
