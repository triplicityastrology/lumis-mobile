import { readFileSync } from "node:fs";

const EXPECTED_REF = "bmqhwofmdgebpcihjlnb";
const EXPECTED_CHECKS = [
  "caree_code_ready",
  "carer_pending_no_authority",
  "caree_decision_required",
  "active",
  "paused",
  "active_after_resume",
  "removed",
  "relationship_cleanup_complete"
];

class EvidenceStop extends Error {
  constructor(code) { super(code); this.code = code; }
}

try {
  const file = process.argv[2];
  stopIf(!file || process.argv.length !== 3, "INPUT_REQUIRED");
  const evidence = JSON.parse(readFileSync(file, "utf8"));
  exactKeys(evidence, [
    "schema_version", "project_ref", "redacted_run_id", "checks",
    "disposable_account_cleanup_count"
  ]);
  stopIf(evidence.schema_version !== 1, "SCHEMA_INVALID");
  stopIf(evidence.project_ref !== EXPECTED_REF, "PROJECT_REF_MISMATCH");
  stopIf(
    typeof evidence.redacted_run_id !== "string"
      || !/^s2-t72-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/u.test(evidence.redacted_run_id),
    "RUN_ID_INVALID"
  );
  stopIf(!Array.isArray(evidence.checks), "CHECKS_INVALID");
  stopIf(
    JSON.stringify(evidence.checks.map((check) => check.name)) !== JSON.stringify(EXPECTED_CHECKS),
    "CHECK_ORDER_INVALID"
  );
  for (const check of evidence.checks) {
    exactKeys(check, ["name", "result"]);
    stopIf(check.result !== "passed", "CHECK_UNCONFIRMED");
  }
  stopIf(evidence.disposable_account_cleanup_count !== 2, "CLEANUP_UNCONFIRMED");
  process.stdout.write("S2_T72_TWO_ACCOUNT_EVIDENCE_PASS\n");
} catch (error) {
  const code = error instanceof EvidenceStop ? error.code : "INPUT_INVALID";
  process.stderr.write(`STOP_S2_T72_${code}\n`);
  process.exitCode = 1;
}

function exactKeys(value, expected) {
  stopIf(value === null || typeof value !== "object" || Array.isArray(value), "FIELD_SHAPE_INVALID");
  stopIf(
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort()),
    "FIELD_SHAPE_INVALID"
  );
}

function stopIf(condition, code) {
  if (condition) throw new EvidenceStop(code);
}
