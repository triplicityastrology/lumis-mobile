import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateBootstrapDescendantAuthority } from "./lib/care-circle-bootstrap-descendant-authority.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t116-care-circle-bootstrap-descendant-authority.json", "utf8"));
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.staging_origin, "https://bmqhwofmdgebpcihjlnb.supabase.co");
assert.deepEqual(control.account_modes, { caree: "standard", carer: "carer_only" });
assert.match(control.approved_technical_ancestor, /^[0-9a-f]{40}$/);
for (const entry of control.locked_operator_files) assert.equal(createHash("sha256").update(readFileSync(entry.path)).digest("hex"), entry.sha256);

const valid = { ancestorPresent: true, dirtyPaths: [], lockedFilesValid: true, projectRef: control.project_ref, origin: control.staging_origin, environmentNames: ["EXPO_PUBLIC_SUPABASE_URL"] };
assert.deepEqual(validateBootstrapDescendantAuthority(valid), { ok: true });
for (const [mutate, code] of [
  [(value) => { value.ancestorPresent = false; }, "ANCESTOR_MISSING"],
  [(value) => { value.dirtyPaths = ["apps/mobile/App.tsx"]; }, "TREE_DIRTY"],
  [(value) => { value.lockedFilesValid = false; }, "OPERATOR_DRIFT"],
  [(value) => { value.projectRef = "other"; }, "WRONG_PROJECT"],
  [(value) => { value.origin = "https://example.test"; }, "WRONG_ORIGIN"],
  [(value) => { value.environmentNames.push("EXPO_PUBLIC_SERVICE_ROLE_KEY"); }, "SECRET_BEARING_EXPO_ENV"],
  [(value) => { value.environmentNames.push("EXPO_PUBLIC_QA_KEY"); }, "SECRET_BEARING_EXPO_ENV"],
]) {
  const fixture = structuredClone(valid); mutate(fixture);
  assert.throws(() => validateBootstrapDescendantAuthority(fixture), new RegExp(`STOP_S2_T116_${code}`));
}
const wrapper = readFileSync("scripts/run-s2-care-circle-bootstrap.zsh", "utf8");
assert.match(wrapper, /s2-care-circle-bootstrap-descendant-authority\.mjs/);
assert.match(wrapper, /READY_FOR_QA_KEY/);
assert.match(wrapper, /stty -echo/);
assert.match(wrapper, /qa_key_revocation=required_now/);
console.log("S2-T116 clean-descendant QA-key bootstrap authority contracts passed");
