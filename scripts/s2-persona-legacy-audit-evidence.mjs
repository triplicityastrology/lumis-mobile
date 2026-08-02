import { readFileSync } from "node:fs";
import { validatePersonaLegacyAuditEvidence } from "./lib/persona-legacy-audit-evidence.mjs";

try {
  if (process.argv.length === 2) {
    process.stdout.write("WAITING_FOR_S2_T161_READ_ONLY_EVIDENCE\nnetwork_calls=0 sql_executed=false migration_authorized=false\n");
  } else if (process.argv.length === 4 && process.argv[2] === "--validate") {
    const result = validatePersonaLegacyAuditEvidence(JSON.parse(readFileSync(process.argv[3], "utf8")));
    if (!result.ok) throw new Error(result.code);
    process.stdout.write("S2_T161_EVIDENCE_ACCEPTED\nmigration_authorized=false\n");
  } else {
    throw new Error("STOP_S2_T161_ARGUMENTS_INVALID");
  }
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T161_[A-Z0-9_]+$/u.test(error.message)
    ? error.message : "STOP_S2_T161_EVIDENCE_UNSAFE";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
