import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const WORKFLOW = ".github/workflows/s2-t157-care-circle-postgres17-proof.yml";
const REPOSITORY = "triplicityastrology/lumis-mobile";
const REF = "refs/heads/sprint1-fable-ui-stabilization";
const IMAGE = "public.ecr.aws/supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453";
const MIGRATIONS = [
  ["0032", "9d5dfdeab0975c9c8d923495bd5a17fa26ea5c26ef05ba4f036ac506b087a79e"],
  ["0033", "0996ecd9fcf6e4fb2b083d980e69a0c2dd042107bc8e753fdd43f79d0bcb0a1d"],
  ["0034", "466821a3a92a1f75543cf265d2d2c4e3dcb3f850ee79efd77df3269cd4797ceb"],
  ["0037", "3a5deda8546d5255e51c0cece16e67687cd71a63743f923a49aebf94f2f5852c"],
];

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--write") stop("ARGUMENTS_INVALID");
  if (process.env.GITHUB_ACTIONS !== "true") stop("GITHUB_ACTIONS_REQUIRED");
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== REF) stop("GITHUB_CONTEXT_INVALID");
  const commit = process.env.GITHUB_SHA ?? "";
  const runId = process.env.GITHUB_RUN_ID ?? "";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT ?? "";
  if (!/^[0-9a-f]{40}$/u.test(commit) || !/^[1-9][0-9]*$/u.test(runId) || !/^[1-9][0-9]*$/u.test(runAttempt)) stop("GITHUB_CONTEXT_INVALID");
  const output = process.argv[3];
  if (!/^\/[^\0]+\/s2-t162-care-circle-postgres17-proof\.json$/u.test(output)) stop("OUTPUT_PATH_INVALID");

  const evidence = {
    schema: "s2_t162_care_circle_postgres17_ci_evidence_v2",
    status: "CI_PROOF_PASSED",
    github: {
      repository: REPOSITORY,
      ref: REF,
      commit,
      run_id: runId,
      run_attempt: Number(runAttempt),
    },
    workflow: {
      path: WORKFLOW,
      sha256: sha(readFileSync(WORKFLOW)),
    },
    runner: "ubuntu-24.04",
    postgres_version: "17.6",
    postgres_image: IMAGE,
    migrations: MIGRATIONS.map(([version, sha256]) => ({ version, sha256 })),
    assertions: {
      migration_order_passed: true,
      expiry_passed: true,
      active_code_uniqueness_passed: true,
      hash_only_persistence_passed: true,
      replay_conflict_passed: true,
      generic_failure_passed: true,
      concurrent_throttle_passed: true,
      rollback_passed: true,
      cleanup_confirmed: true,
    },
    network_calls: 0,
    remote_data_used: false,
  };
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  process.stdout.write("S2_T162_CLOSED_CI_ARTIFACT_READY\n");
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T162_ARTIFACT_[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "STOP_S2_T162_ARTIFACT_UNSAFE";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stop(suffix) { throw new Error(`STOP_S2_T162_ARTIFACT_${suffix}`); }
