import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const wrapper = readFileSync("scripts/run-s2-care-circle-two-account-evidence.zsh", "utf8");
const plan = JSON.parse(readFileSync("supabase/tests/s2-t41-two-account-evidence-plan.json", "utf8"));
const summary = readFileSync("apps/mobile/test-workbenches/care-circle-staging/workbenchEvidenceSummary.ts", "utf8");
const screen = readFileSync("apps/mobile/test-workbenches/care-circle-staging/CareCircleStagingWorkbench.tsx", "utf8");

assert.deepEqual(plan.actors, { caree: 1, carer: 1, existing_accounts_allowed: false });
assert.match(JSON.stringify(plan.ordered_device_steps), /ten_minute/);
assert.match(JSON.stringify(plan.ordered_device_steps), /copy_pairing_code/);
for (const field of ["code_ready", "code_copied", "pending_no_authority", "accepted_active", "paused", "resumed", "self_removed", "relationship_cleanup"]) assert.match(summary, new RegExp(`"${field}"`));
assert.match(screen, /onCodeCopied\?\.\(\)/);
assert.match(wrapper, /care-circle-founder-receipt\.json/);
assert.match(wrapper, /run-s2-care-circle-bootstrap\.zsh/);
assert.match(wrapper, /S2_T144_NOT_READY/);
assert.match(wrapper, /ZERO_RESIDUE_CONFIRMED/);
assert.doesNotMatch(wrapper, /sb_secret_|SUPABASE_ACCESS_TOKEN|SERVICE_ROLE|pairing_code=|https?:\/\/|pbcopy|tee |set -x/);

const preflight = spawnSync("zsh", ["scripts/run-s2-care-circle-two-account-evidence.zsh"], { encoding: "utf8" });
assert.equal(preflight.status, 0, preflight.stderr);
assert.match(preflight.stdout, /S2_T144_NOT_READY|S2_T144_READY_FOR_QA_KEY/);
assert.match(preflight.stdout, /network_calls=0 credentials_requested=0 accounts_created=0/);
assert.doesNotMatch(preflight.stdout + preflight.stderr, /bmqhwofmdgebpcihjlnb|@|https?:\/\/|[0-9a-f]{40,}/);
console.log("S2-T144 two-account evidence and cleanup kit contract passed; preflight remained inert.");
