import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { appendCheckpoint, nextStage, validateCheckpoint } from "./lib/care-circle-0037-window.mjs";
import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

const CONTROL_PATH = "supabase/tests/s2-t143-care-circle-0037-window-control.json";
const CHECKPOINT_PATH = ".lumis-local/s2-t143-care-circle-0037-window.json";
const RECEIPT_PATH = ".lumis-local/s2-t143-care-circle-0037-window-receipt.json";
const REHEARSAL_RECEIPT_PATH = ".lumis-local/s2-t158-care-circle-0037-rehearsal-receipt.json";

try {
  validateFourDigitSeal();
  const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));
  verifySource(control);
  const checkpoint = readCheckpoint(control);
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "status") {
    printStatus(checkpoint, control);
  } else if (args.mode === "prepare") {
    const next = nextStage(checkpoint, control);
    if (args.stage !== next) stop("STAGE_NOT_READY");
    process.stdout.write([
      "S2_T143_STAGE_READY",
      `stage=${args.stage}`,
      `operator=${operatorFor(args.stage)}`,
      "explicit_remote_action_required=true",
      "network_calls=0 credentials_requested=0 filesystem_writes=0",
    ].join("\n") + "\n");
  } else {
    if (args.stage === "rehearsal_accepted") verifyRehearsalReceipt(args.evidenceSha256);
    const next = appendCheckpoint(checkpoint, args.stage, args.evidenceSha256, control);
    mkdirSync(".lumis-local", { recursive: true, mode: 0o700 });
    writeFileSync(CHECKPOINT_PATH, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    if (args.stage === "receipt_sealed") {
      writeFileSync(RECEIPT_PATH, JSON.stringify({
        receipt: "s2_t143_care_circle_0037_window_v1",
        project_ref: control.project_ref,
        completed: true,
        checkpoint_digest: next.digest,
        source_digest: sourceDigest(control),
      }, null, 2) + "\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
    }
    process.stdout.write(`S2_T143_CHECKPOINT_RECORDED\nstage=${args.stage}\nnext=${nextStage(next, control) ?? "complete"}\n`);
  }
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T143_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T143_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function verifyRehearsalReceipt(expectedEvidenceSha256) {
  if (!existsSync(REHEARSAL_RECEIPT_PATH)) stop("REHEARSAL_ENVELOPE_REQUIRED");
  const receipt = JSON.parse(readFileSync(REHEARSAL_RECEIPT_PATH, "utf8"));
  const keys = Object.keys(receipt).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["digest", "evidence_sha256", "schema", "status"])) stop("REHEARSAL_RECEIPT_INVALID");
  if (receipt.schema !== "s2_t158_care_circle_0037_rehearsal_receipt_v1" || receipt.status !== "accepted" || receipt.evidence_sha256 !== expectedEvidenceSha256) stop("REHEARSAL_RECEIPT_INVALID");
  const core = { schema: receipt.schema, status: receipt.status, evidence_sha256: receipt.evidence_sha256 };
  if (receipt.digest !== sha(Buffer.from(JSON.stringify(core)))) stop("REHEARSAL_RECEIPT_INVALID");
}

function verifySource(control) {
  if (control.project_ref !== "bmqhwofmdgebpcihjlnb" || control.default_mode !== "inert_zero_network") stop("CONTROL_INVALID");
  const predecessor = readFileSync(control.predecessor_evidence.path);
  if (sha(predecessor) !== control.predecessor_evidence.sha256) stop("PREDECESSOR_EVIDENCE_DRIFT");
  const predecessorText = predecessor.toString("utf8");
  if (!/0032.*0033.*0034/su.test(predecessorText) || !/Unexpected versions in the controlled query: 0/u.test(predecessorText)) stop("PREDECESSOR_PARITY_INVALID");
  for (const entry of control.locked_files) if (sha(readFileSync(entry.path)) !== entry.sha256) stop("SOURCE_DRIFT");
}

function readCheckpoint(control) {
  if (!existsSync(CHECKPOINT_PATH)) return null;
  return validateCheckpoint(JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8")), control);
}

function parseArgs(values) {
  if (values.length === 0) return { mode: "status" };
  if (values.length === 2 && values[0] === "--prepare-stage") return { mode: "prepare", stage: values[1] };
  if (values.length === 5 && values[0] === "--record-stage" && values[2] === "--evidence-sha256" && values[4] === "--accepted") {
    return { mode: "record", stage: values[1], evidenceSha256: values[3] };
  }
  stop("ARGUMENTS_INVALID");
}

function operatorFor(stage) {
  const operators = {
    rehearsal_accepted: "Dashboard rehearsal packet; rollback and zero-residue proof required",
    migration_0037_recorded: "Dashboard apply packet; atomic migration and history parity required",
    pairing_secret_verified_and_pat_revoked: "scripts/run-s2-care-circle-pairing-secret-provision.zsh",
    function_deployed_and_pat_revoked: "scripts/run-s2-care-circle-pat-deploy.zsh",
    health_passed: "scripts/run-s2-care-circle-function-health.zsh",
    receipt_sealed: "scripts/s2-care-circle-founder-receipt.mjs",
  };
  return operators[stage] ?? "none";
}

function printStatus(checkpoint, control) {
  process.stdout.write([
    "S2_T143_CARE_CIRCLE_0037_WINDOW",
    `completed_count=${checkpoint?.completed.length ?? 0}`,
    `next=${nextStage(checkpoint, control) ?? "complete"}`,
    "default_mode=inert_zero_network",
    "network_calls=0 credentials_requested=0 filesystem_writes=0",
  ].join("\n") + "\n");
}

function sourceDigest(control) { return sha(Buffer.from(control.locked_files.map(({ name, sha256 }) => `${name}:${sha256}`).join("\n"))); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stop(code) { throw new Error(`STOP_S2_T143_${code}`); }
