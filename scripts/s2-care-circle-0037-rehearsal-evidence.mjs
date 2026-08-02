import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { evidenceSha256, validateRehearsalEvidence } from "./lib/care-circle-0037-rehearsal-evidence.mjs";

const RECEIPT_PATH = ".lumis-local/s2-t158-care-circle-0037-rehearsal-receipt.json";

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") stop("ARGUMENTS_INVALID");
  const evidence = validateRehearsalEvidence(JSON.parse(readFileSync(process.argv[3], "utf8")));
  const receiptCore = {
    schema: "s2_t158_care_circle_0037_rehearsal_receipt_v1",
    status: "accepted",
    evidence_sha256: evidenceSha256(evidence),
  };
  const receipt = { ...receiptCore, digest: createHash("sha256").update(JSON.stringify(receiptCore)).digest("hex") };
  mkdirSync(".lumis-local", { recursive: true, mode: 0o700 });
  writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  process.stdout.write("S2_T158_ACCEPTED\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T158_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T158_ENVELOPE_INVALID";
  process.stderr.write(`S2_T158_RETURNED ${code}\n`);
  process.exitCode = 1;
}

function stop(code) { throw new Error(`STOP_S2_T158_${code}`); }
