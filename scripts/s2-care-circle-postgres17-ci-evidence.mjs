import { readFileSync } from "node:fs";
import { writePostgres17CiReceipt } from "./lib/care-circle-postgres17-ci-evidence.mjs";

try {
  if (process.argv.length === 2) {
    process.stdout.write("WAITING_FOR_AUTHORISED_CI_EVIDENCE\nnetwork_calls=0 staging_ready=false remote_writes_authorized=false\n");
  } else if (process.argv.length === 4 && process.argv[2] === "--accept") {
    const evidence = JSON.parse(readFileSync(process.argv[3], "utf8"));
    const result = writePostgres17CiReceipt(evidence);
    if (!result.ok) throw new Error(result.code);
    process.stdout.write("S2_T162_DATABASE_PROOF_RECORDED\nstaging_ready=false remote_writes_authorized=false\n");
  } else {
    throw new Error("STOP_S2_T162_ARGUMENTS_INVALID");
  }
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T162_[A-Z0-9_]+$/u.test(error.message)
    ? error.message : "STOP_S2_T162_EVIDENCE_UNSAFE";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

