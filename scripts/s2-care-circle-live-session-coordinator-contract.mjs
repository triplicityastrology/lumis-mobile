import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import {
  createSessionReceipt,
  LIVE_SESSION_ACTIONS,
  LIVE_SESSION_STAGES,
  resolveLiveSessionAction,
  validateSessionReceipt,
} from "./lib/care-circle-live-session-coordinator.mjs";

const remote = ["rehearsal_accepted", "migration_0037_recorded", "pairing_secret_verified_and_pat_revoked", "function_deployed_and_pat_revoked", "health_passed", "receipt_sealed"];
const control = JSON.parse(readFileSync("supabase/tests/s2-t147-care-circle-live-session-control.json", "utf8"));
assert.equal(control.project_ref, "bmqhwofmdgebpcihjlnb");
assert.equal(control.default_mode, "zero_network_recovery_safe");
assert.deepEqual(control.session_stages, LIVE_SESSION_STAGES);
assert.equal(resolveLiveSessionAction({ remoteStages: [], sessionStages: [] }).nextAction, LIVE_SESSION_ACTIONS.rehearsal);
assert.equal(resolveLiveSessionAction({ remoteStages: remote.slice(0, 1), sessionStages: [] }).nextAction, LIVE_SESSION_ACTIONS.migration);
assert.equal(resolveLiveSessionAction({ remoteStages: remote, sessionStages: [] }).nextAction, LIVE_SESSION_ACTIONS.bootstrap);
const interrupted = resolveLiveSessionAction({ remoteStages: remote, sessionStages: ["accounts_ready"] });
assert.deepEqual(interrupted, { nextAction: LIVE_SESSION_ACTIONS.cleanup, cleanupRequired: true, qaKeyRevocationRequired: true });
assert.equal(resolveLiveSessionAction({ remoteStages: remote, sessionStages: ["accounts_ready"], continueSession: true }).nextAction, LIVE_SESSION_ACTIONS.mobile);
assert.equal(resolveLiveSessionAction({ remoteStages: remote, sessionStages: LIVE_SESSION_STAGES.slice(0, 3) }).nextAction, LIVE_SESSION_ACTIONS.cleanup);
assert.equal(resolveLiveSessionAction({ remoteStages: remote, sessionStages: LIVE_SESSION_STAGES.slice(0, 4) }).nextAction, LIVE_SESSION_ACTIONS.revoke);
assert.equal(resolveLiveSessionAction({ remoteStages: remote, sessionStages: LIVE_SESSION_STAGES }).nextAction, LIVE_SESSION_ACTIONS.complete);
assert.throws(() => resolveLiveSessionAction({ remoteStages: [remote[1]], sessionStages: [] }), /STOP_S2_T147_REMOTE_ORDER_INVALID/);

const receipt = createSessionReceipt(LIVE_SESSION_STAGES.slice(0, 2).map((stage, index) => ({ stage, evidence_sha256: String(index).repeat(64) })));
assert.deepEqual(validateSessionReceipt(receipt), receipt);
assert.throws(() => validateSessionReceipt({ ...receipt, user_id: "forbidden" }), /STOP_S2_T147_RECEIPT_FIELDS_INVALID/);
assert.throws(() => validateSessionReceipt({ ...receipt, digest: "0".repeat(64) }), /STOP_S2_T147_RECEIPT_DIGEST_INVALID/);

const source = readFileSync("scripts/s2-care-circle-live-session-coordinator.mjs", "utf8");
assert.doesNotMatch(source, /fetch\(|https?:\/\/|@supabase|SUPABASE_ACCESS_TOKEN|service_role|pairing_code|email|user_id/iu);
const run = spawnSync(process.execPath, ["scripts/s2-care-circle-live-session-coordinator.mjs"], { encoding: "utf8" });
assert.equal(run.status, 0, run.stderr);
assert.match(run.stdout, /remote_success_inferred=0 network_calls=0 credentials_requested=0/);

const runbook = readFileSync("docs/qa/S2-T147-care-circle-founder-live-session.md", "utf8");
for (const phrase of ["My check-in code", "Pending Caree acceptance", "Pause", "Resume", "Leave Care Circle", "Cleanup", "Revoke the temporary QA key"]) assert.match(runbook, new RegExp(phrase, "u"));
assert.doesNotMatch(runbook, /scaffold|admin panel|raw response|service.role/iu);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.match(packageJson.scripts["test:care-circle-aggregate-static"], /test:s2-care-circle-live-session/u);
console.log("S2-T147 Founder live-session coordinator contracts passed; recovery remains cleanup-first.");
