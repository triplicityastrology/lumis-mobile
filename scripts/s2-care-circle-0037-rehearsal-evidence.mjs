import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { createTrustedSession, evidenceSha256, REHEARSAL_OPERATOR_SHA256, validateRehearsalEvidence } from "./lib/care-circle-0037-rehearsal-evidence.mjs";

const RECEIPT_PATH = ".lumis-local/s2-t158-care-circle-0037-rehearsal-receipt.json";
const SESSION_PATH = ".lumis-local/s2-t164-care-circle-0037-rehearsal-session.json";

try {
  if (process.argv.length === 2) {
    process.stdout.write("WAITING_FOR_TRUSTED_S2_T164_REHEARSAL_SESSION\nnetwork_calls=0 receipt_created=false\n");
  } else if (process.argv.length === 3 && process.argv[2] === "--prepare-session") {
    verifyOperatorSource();
    if (existsSync(SESSION_PATH) || existsSync(RECEIPT_PATH)) stop("ATTESTATION_STATE_EXISTS");
    const sessionNonce = randomBytes(32).toString("hex");
    const session = createTrustedSession(sessionNonce);
    mkdirSync(".lumis-local", { recursive: true, mode: 0o700 });
    writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2) + "\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
    process.stdout.write(`S2_T164_TRUSTED_SESSION_PREPARED\nsession_nonce=${sessionNonce}\nnetwork_calls=0 receipt_created=false\n`);
  } else if (process.argv.length === 4 && process.argv[2] === "--input") {
    verifyOperatorSource();
    if (!existsSync(SESSION_PATH)) stop("ATTESTATION_REQUIRED");
    const session = JSON.parse(readFileSync(SESSION_PATH, "utf8"));
    const evidence = validateRehearsalEvidence(JSON.parse(readFileSync(process.argv[3], "utf8")), session);
    const receiptCore = {
      schema: "s2_t158_care_circle_0037_rehearsal_receipt_v1",
      status: "accepted",
      evidence_sha256: evidenceSha256(evidence),
      operator_sha256: session.operator_sha256,
      session_nonce_sha256: session.nonce_sha256,
      attestation_digest: createHash("sha256").update(JSON.stringify(evidence.attestation)).digest("hex"),
    };
    const receipt = { ...receiptCore, digest: createHash("sha256").update(JSON.stringify(receiptCore)).digest("hex") };
    const consumed = { ...session, status: "consumed", consumed: true };
    writeFileSync(`${SESSION_PATH}.tmp`, JSON.stringify(consumed, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    writeFileSync(`${RECEIPT_PATH}.tmp`, JSON.stringify(receipt, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    renameSync(`${SESSION_PATH}.tmp`, SESSION_PATH);
    renameSync(`${RECEIPT_PATH}.tmp`, RECEIPT_PATH);
    process.stdout.write("S2_T158_ACCEPTED_ATTESTED\n");
  } else {
    stop("ARGUMENTS_INVALID");
  }
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T158_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T158_ENVELOPE_INVALID";
  process.stderr.write(`S2_T158_RETURNED ${code}\n`);
  process.exitCode = 1;
}

function stop(code) { throw new Error(`STOP_S2_T158_${code}`); }
function verifyOperatorSource() {
  const source = readFileSync("supabase/dashboard-packets/s2-t140/0037_four_digit_care_pairing_codes.rehearsal.sql");
  if (createHash("sha256").update(source).digest("hex") !== REHEARSAL_OPERATOR_SHA256) stop("ATTESTATION_SOURCE_INVALID");
}
