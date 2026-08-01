import assert from "node:assert/strict";

import { createAccountRestoreFreshnessGate } from "./accountRestoreFreshness";
import { resolveBirthChangeQuota } from "./birthChangeQuota";

assert.deepEqual(resolveBirthChangeQuota(0), { successfulChanges: 0, remainingChanges: 3 });
assert.deepEqual(resolveBirthChangeQuota(3), { successfulChanges: 3, remainingChanges: 0 });
for (const invalid of [-1, 4, 1.5, "0", null]) {
  assert.throws(() => resolveBirthChangeQuota(invalid), /BIRTH_CHANGE_COUNT_INVALID/);
}

const gate = createAccountRestoreFreshnessGate();
const coldStart = gate.begin();
const reload = gate.begin();
assert.equal(coldStart.isCurrent(), false, "an older cold-start response cannot overwrite Reload Account");
assert.equal(reload.isCurrent(), true, "the latest authoritative reload remains applicable");
