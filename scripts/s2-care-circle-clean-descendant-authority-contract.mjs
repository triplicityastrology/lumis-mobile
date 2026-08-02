import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateCleanDescendantAuthority } from "./lib/care-circle-clean-descendant-authority.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t115-care-circle-descendant-authority.json", "utf8"));
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.match(control.approved_technical_ancestor, /^[0-9a-f]{40}$/);
assert.equal(control.execution_default, "local_validation_only");
assert.equal(control.locked_operator_files.length, 9);
for (const entry of control.locked_operator_files) {
  assert.equal(createHash("sha256").update(readFileSync(entry.path)).digest("hex"), entry.sha256);
}

const valid = { ancestorPresent: true, dirtyPaths: [], changedPaths: ["apps/mobile/src/screens/LumisHomeScreen.tsx"], lockedFilesValid: true };
assert.deepEqual(validateCleanDescendantAuthority(valid), { ok: true });
for (const [name, mutate, code] of [
  ["missing ancestor", (value) => { value.ancestorPresent = false; }, "ANCESTOR_MISSING"],
  ["dirty tree", (value) => { value.dirtyPaths = ["apps/mobile/App.tsx"]; }, "TREE_DIRTY"],
  ["migration drift", (value) => { value.changedPaths.push("supabase/migrations/0034_reusable_care_pairing_operations.sql"); }, "PROHIBITED_BACKEND_DRIFT"],
  ["function drift", (value) => { value.changedPaths.push("supabase/functions/care-circle/index.ts"); }, "PROHIBITED_BACKEND_DRIFT"],
  ["operator drift", (value) => { value.lockedFilesValid = false; }, "OPERATOR_DRIFT"],
]) {
  const fixture = structuredClone(valid);
  mutate(fixture);
  assert.throws(() => validateCleanDescendantAuthority(fixture), new RegExp(`STOP_S2_T115_${code}`), name);
}

const operator = readFileSync("scripts/run-s2-care-circle-pat-deploy.zsh", "utf8");
assert.match(operator, /--approved-technical-ancestor/);
assert.match(operator, /s2-care-circle-clean-descendant-authority\.mjs/);
assert.doesNotMatch(operator, /--approved-source-sha|APPROVED_SOURCE_SHA/);
assert.match(operator, /IFS= read -r -s/);
assert.match(operator, /functions deploy "\$FUNCTION_NAME"/);
assert.match(operator, /PAT_REVOKE_VERIFIED/);
console.log("S2-T115 clean-descendant Care Circle PAT authority contracts passed");
