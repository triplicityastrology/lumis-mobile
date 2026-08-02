import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CONTROL = "supabase/tests/s2-t157-care-circle-postgres17-ci-control.json";

try {
  if ((process.argv.length !== 3 && process.argv.length !== 4) || process.argv[2] !== "--verify") stop("ARGUMENTS_INVALID");
  rejectRemoteEnvironment();
  const control = JSON.parse(readFileSync(process.argv[3] ?? CONTROL, "utf8"));
  if (control.schema !== "s2_t157_care_circle_postgres17_ci_control_v1" || control.status !== "READY_FOR_CI_EXECUTION") stop("CONTROL_INVALID");
  if (control.runtime.postgres_image !== "public.ecr.aws/supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453" || control.runtime.runner !== "ubuntu-24.04") stop("RUNTIME_INVALID");
  if (!/^[a-z0-9./-]+@sha256:[0-9a-f]{64}$/u.test(control.runtime.postgres_image)) stop("RUNTIME_NOT_IMMUTABLE");
  const ordered = control.ordered_sources.map(({ path }) => path.match(/\/(0032|0033|0034|0037)_/u)?.[1]);
  if (JSON.stringify(ordered) !== JSON.stringify(["0032", "0033", "0034", "0037"])) stop("MIGRATION_ORDER_INVALID");
  for (const entry of [...control.ordered_sources, ...control.proof_sources]) {
    if (!entry || typeof entry.path !== "string" || !/^[a-zA-Z0-9_./-]+$/u.test(entry.path) || !/^[0-9a-f]{64}$/u.test(entry.sha256)) stop("SOURCE_ENTRY_INVALID");
    if (sha(readFileSync(entry.path)) !== entry.sha256) stop("SOURCE_DRIFT");
  }
  process.stdout.write("S2_T157_READY_FOR_CI_EXECUTION\nnetwork_calls=0 remote_database_context=absent ci_proof_claimed=false\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T157_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T157_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function rejectRemoteEnvironment() {
  for (const name of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "DATABASE_URL", "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
    if (process.env[name]) stop("REMOTE_DATABASE_CONTEXT_PRESENT");
  }
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stop(code) { throw new Error(`STOP_S2_T157_${code}`); }
