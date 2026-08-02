import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { validateCheckpoint } from "./lib/care-circle-0037-window.mjs";
import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";
import { createSessionReceipt, LIVE_SESSION_STAGES, resolveLiveSessionAction, validateSessionReceipt } from "./lib/care-circle-live-session-coordinator.mjs";

const WINDOW_CONTROL = "supabase/tests/s2-t143-care-circle-0037-window-control.json";
const WINDOW_CHECKPOINT = ".lumis-local/s2-t143-care-circle-0037-window.json";
const SESSION_RECEIPT = ".lumis-local/s2-t147-care-circle-live-session.json";

try {
  const args = parseArgs(process.argv.slice(2));
  validateFourDigitSeal();
  const control = JSON.parse(readFileSync(WINDOW_CONTROL, "utf8"));
  if (control.project_ref !== "bmqhwofmdgebpcihjlnb") stop("PROJECT_INVALID");
  const checkpoint = existsSync(WINDOW_CHECKPOINT)
    ? validateCheckpoint(JSON.parse(readFileSync(WINDOW_CHECKPOINT, "utf8")), control)
    : null;
  const session = existsSync(SESSION_RECEIPT)
    ? validateSessionReceipt(JSON.parse(readFileSync(SESSION_RECEIPT, "utf8")))
    : { entries: [] };
  if (args.mode === "record") {
    if (session.entries.length >= LIVE_SESSION_STAGES.length || LIVE_SESSION_STAGES[session.entries.length] !== args.stage) stop("STAGE_NOT_READY");
    const nextReceipt = createSessionReceipt([...session.entries, { stage: args.stage, evidence_sha256: args.evidenceSha256 }]);
    mkdirSync(".lumis-local", { recursive: true, mode: 0o700 });
    const temporary = `${SESSION_RECEIPT}.tmp`;
    writeFileSync(temporary, JSON.stringify(nextReceipt, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, SESSION_RECEIPT);
    process.stdout.write(`S2_T147_SESSION_STAGE_RECORDED\nstage=${args.stage}\nnetwork_calls=0 credentials_requested=0\n`);
    process.exit(0);
  }
  const result = resolveLiveSessionAction({
    remoteStages: checkpoint?.completed.map(({ stage }) => stage) ?? [],
    sessionStages: session.entries.map(({ stage }) => stage),
    continueSession: args.continueSession,
  });
  process.stdout.write([
    "S2_T147_CARE_CIRCLE_FOUNDER_SESSION",
    `next_safe_action=${result.nextAction}`,
    `cleanup_required=${result.cleanupRequired}`,
    `qa_key_revocation_required=${result.qaKeyRevocationRequired}`,
    `continuation_intent=${args.continueSession ? "explicit" : "recovery_safe"}`,
    "remote_success_inferred=0 network_calls=0 credentials_requested=0",
  ].join("\n") + "\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T147_[A-Z0-9_]+$/u.test(error.message)
    ? error.message : "STOP_S2_T147_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  if (values.length === 0) return { mode: "status", continueSession: false };
  if (values.length === 1 && values[0] === "--continue-session") return { mode: "status", continueSession: true };
  if (values.length === 5 && values[0] === "--record-stage" && values[2] === "--evidence-sha256" && values[4] === "--accepted" && /^[0-9a-f]{64}$/u.test(values[3])) {
    return { mode: "record", stage: values[1], evidenceSha256: values[3], continueSession: false };
  }
  stop("ARGUMENTS_INVALID");
}

function stop(code) { throw new Error(`STOP_S2_T147_${code}`); }
