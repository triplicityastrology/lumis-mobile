import assert from "node:assert/strict";
import {
  createFounderReflectionDeletionState,
  reduceFounderReflectionDeletion,
} from "./founderReflectionDeletionJourney";

const initial = createFounderReflectionDeletionState();
const opened = reduceFounderReflectionDeletion(initial, { type: "open_confirmation" });
const cancelled = reduceFounderReflectionDeletion(opened, { type: "cancel" });
assert.equal(cancelled.rowPresent, true, "Cancel must preserve the disposable row");
assert.equal(cancelled.attempts, 0);

const reopened = reduceFounderReflectionDeletion(cancelled, { type: "open_confirmation" });
const failed = reduceFounderReflectionDeletion(reopened, { type: "confirm" });
assert.equal(failed.phase, "failed");
assert.equal(failed.rowPresent, true, "A failed deletion must preserve the row");
assert.equal(failed.dialogOpen, true, "Failure feedback must retain Retry and Cancel");
assert.equal(failed.requestId, initial.requestId, "The logical request identity must remain stable");

const deleted = reduceFounderReflectionDeletion(failed, { type: "confirm" });
assert.equal(deleted.phase, "deleted");
assert.equal(deleted.rowPresent, false, "Only confirmed success may remove the row");
assert.equal(deleted.requestId, initial.requestId, "Retry must reuse the same request identity");
assert.equal(deleted.attempts, 2);

const reset = reduceFounderReflectionDeletion(deleted, { type: "reset" });
assert.deepEqual(reset, initial);
console.log("Founder reflection deletion journey fixtures passed.");
