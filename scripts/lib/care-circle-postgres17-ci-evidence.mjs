import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export const CI_RECEIPT_PATH = ".lumis-local/s2-t162-care-circle-postgres17-ci-receipt.json";
export const EXPECTED_REPOSITORY = "triplicityastrology/lumis-mobile";
export const EXPECTED_REF = "refs/heads/sprint1-fable-ui-stabilization";
export const EXPECTED_WORKFLOW = ".github/workflows/s2-t157-care-circle-postgres17-proof.yml";
export const EXPECTED_WORKFLOW_SHA256 = "3a5d2edf5780216abac14a3a7f0004c106e0e53c4bb8de3f0120c2adc222f4d2";
const SIGNER_WORKFLOW = `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW}`;
const IMAGE = "public.ecr.aws/supabase/postgres@sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453";
const MIGRATIONS = [
  ["0032", "9d5dfdeab0975c9c8d923495bd5a17fa26ea5c26ef05ba4f036ac506b087a79e"],
  ["0033", "0996ecd9fcf6e4fb2b083d980e69a0c2dd042107bc8e753fdd43f79d0bcb0a1d"],
  ["0034", "466821a3a92a1f75543cf265d2d2c4e3dcb3f850ee79efd77df3269cd4797ceb"],
  ["0037", "3a5deda8546d5255e51c0cece16e67687cd71a63743f923a49aebf94f2f5852c"],
];
const ROOT_KEYS = ["schema", "status", "github", "workflow", "runner", "postgres_version", "postgres_image", "migrations", "assertions", "network_calls", "remote_data_used"];
const GITHUB_KEYS = ["repository", "ref", "commit", "run_id", "run_attempt"];
const WORKFLOW_KEYS = ["path", "sha256"];
const ASSERTION_KEYS = ["migration_order_passed", "expiry_passed", "active_code_uniqueness_passed", "hash_only_persistence_passed", "replay_conflict_passed", "generic_failure_passed", "concurrent_throttle_passed", "rollback_passed", "cleanup_confirmed"];
const VERIFIED = Symbol("verified-github-attestation");

export function validatePostgres17CiEvidence(value) {
  if (!isRecord(value) || !sameKeys(value, ROOT_KEYS)) return stop("SCHEMA_INVALID");
  if (value.schema !== "s2_t162_care_circle_postgres17_ci_evidence_v2" || value.status !== "CI_PROOF_PASSED") return stop("STATUS_INVALID");
  if (!isRecord(value.github) || !sameKeys(value.github, GITHUB_KEYS)) return stop("GITHUB_PROVENANCE_INVALID");
  if (value.github.repository !== EXPECTED_REPOSITORY || value.github.ref !== EXPECTED_REF || !/^[0-9a-f]{40}$/u.test(value.github.commit) || !/^[1-9][0-9]*$/u.test(value.github.run_id) || !Number.isSafeInteger(value.github.run_attempt) || value.github.run_attempt < 1) return stop("GITHUB_PROVENANCE_INVALID");
  if (!isRecord(value.workflow) || !sameKeys(value.workflow, WORKFLOW_KEYS) || value.workflow.path !== EXPECTED_WORKFLOW || value.workflow.sha256 !== EXPECTED_WORKFLOW_SHA256) return stop("WORKFLOW_DRIFT");
  if (value.runner !== "ubuntu-24.04" || value.postgres_version !== "17.6" || value.postgres_image !== IMAGE || !/@sha256:[0-9a-f]{64}$/u.test(value.postgres_image)) return stop("RUNTIME_INVALID");
  if (!Array.isArray(value.migrations) || value.migrations.length !== MIGRATIONS.length) return stop("MIGRATION_EVIDENCE_INVALID");
  for (let index = 0; index < MIGRATIONS.length; index += 1) {
    const entry = value.migrations[index];
    if (!isRecord(entry) || !sameKeys(entry, ["version", "sha256"]) || entry.version !== MIGRATIONS[index][0] || entry.sha256 !== MIGRATIONS[index][1]) return stop("MIGRATION_EVIDENCE_INVALID");
  }
  if (!isRecord(value.assertions) || !sameKeys(value.assertions, ASSERTION_KEYS) || !ASSERTION_KEYS.every((key) => value.assertions[key] === true)) return stop("PROOF_INCOMPLETE");
  if (value.network_calls !== 0 || value.remote_data_used !== false) return stop("REMOTE_BOUNDARY_INVALID");
  if (containsUnsafeEvidence(value)) return stop("UNSAFE_EVIDENCE");
  return { ok: true, evidenceSha256: sha(JSON.stringify(value)) };
}

export function validateGitHubVerificationOutputForTest(rawOutput, evidence, artifactSha256) {
  return validateGitHubVerificationOutput(rawOutput, evidence, artifactSha256).result;
}

export function verifyAttestedArtifactAndWriteReceipt(artifactPath) {
  const canonicalArtifact = path.resolve(artifactPath);
  if (canonicalArtifact.startsWith(`${path.resolve(".")}${path.sep}`) || !canonicalArtifact.endsWith(".json")) return stop("ARTIFACT_PATH_INVALID");
  if (!existsSync(canonicalArtifact) || statSync(canonicalArtifact).size > 64 * 1024) return stop("ARTIFACT_INVALID");
  let evidence;
  try {
    evidence = JSON.parse(readFileSync(canonicalArtifact, "utf8"));
  } catch {
    return stop("ARTIFACT_INVALID");
  }
  const validated = validatePostgres17CiEvidence(evidence);
  if (!validated.ok) return validated;
  if (readCommand("git", ["rev-parse", "HEAD"]) !== evidence.github.commit) return stop("SOURCE_COMMIT_MISMATCH");
  if (readCommand("git", ["status", "--porcelain"]) !== "") return stop("SOURCE_TREE_DIRTY");

  const artifactSha256 = sha(readFileSync(canonicalArtifact));
  const verification = spawnSync("gh", [
    "attestation", "verify", canonicalArtifact,
    "--repo", EXPECTED_REPOSITORY,
    "--signer-workflow", SIGNER_WORKFLOW,
    "--source-ref", EXPECTED_REF,
    "--source-digest", evidence.github.commit,
    "--signer-digest", evidence.github.commit,
    "--deny-self-hosted-runners",
    "--format", "json",
  ], { encoding: "utf8", env: safeGhEnvironment() });
  if (verification.status !== 0 || !verification.stdout) return stop("ATTESTATION_VERIFICATION_FAILED");
  const origin = validateGitHubVerificationOutput(verification.stdout, evidence, artifactSha256);
  if (!origin.result.ok) return origin.result;
  return writePostgres17CiReceipt(evidence, origin.verifiedOrigin);
}

function validateGitHubVerificationOutput(rawOutput, evidence, artifactSha256) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return { result: stop("ATTESTATION_OUTPUT_INVALID") };
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0]) || !isRecord(parsed[0].verificationResult)) return { result: stop("ATTESTATION_OUTPUT_INVALID") };
  const result = parsed[0].verificationResult;
  const statement = result.statement;
  const certificate = result.signature?.certificate;
  if (!isRecord(statement) || statement.predicateType !== "https://slsa.dev/provenance/v1" || !isRecord(certificate)) return { result: stop("ATTESTATION_OUTPUT_INVALID") };
  const subjectMatches = Array.isArray(statement.subject) && statement.subject.some((subject) => subject?.digest?.sha256 === artifactSha256);
  if (!subjectMatches) return { result: stop("ATTESTATION_SUBJECT_MISMATCH") };
  const signedClaims = collectStrings(certificate);
  const requiredClaims = [
    EXPECTED_REPOSITORY,
    EXPECTED_WORKFLOW,
    evidence.github.ref,
    evidence.github.commit,
    `actions/runs/${evidence.github.run_id}/attempts/${evidence.github.run_attempt}`,
    "github-hosted",
  ];
  if (!requiredClaims.every((expected) => signedClaims.some((claim) => claim.includes(expected)))) return { result: stop("ATTESTATION_PROVENANCE_MISMATCH") };
  return {
    result: { ok: true },
    verifiedOrigin: {
      [VERIFIED]: true,
      attestationSha256: sha(JSON.stringify(parsed[0].attestation ?? parsed[0])),
      artifactSha256,
      runId: evidence.github.run_id,
      runAttempt: evidence.github.run_attempt,
    },
  };
}

function writePostgres17CiReceipt(evidence, origin) {
  if (!origin || origin[VERIFIED] !== true) return stop("ATTESTATION_REQUIRED");
  const canonical = path.resolve(CI_RECEIPT_PATH);
  if (existsSync(canonical)) return stop("ATTESTATION_REPLAY");
  const receipt = {
    schema: "s2_t162_care_circle_postgres17_ci_receipt_v2",
    status: "database_proof_recorded",
    repository: EXPECTED_REPOSITORY,
    ref: EXPECTED_REF,
    source_commit: evidence.github.commit,
    workflow_sha256: EXPECTED_WORKFLOW_SHA256,
    run_id: origin.runId,
    run_attempt: origin.runAttempt,
    artifact_sha256: origin.artifactSha256,
    attestation_sha256: origin.attestationSha256,
    evidence_sha256: sha(JSON.stringify(evidence)),
    staging_ready: false,
    remote_writes_authorized: false,
  };
  mkdirSync(path.dirname(canonical), { recursive: true, mode: 0o700 });
  const temporary = `${canonical}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  renameSync(temporary, canonical);
  return { ok: true, receipt };
}

function readCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}
function safeGhEnvironment() {
  const { GH_TOKEN: _ghToken, GITHUB_TOKEN: _githubToken, ...rest } = process.env;
  return { ...rest, GH_PROMPT_DISABLED: "1", GH_PAGER: "cat" };
}
function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, output));
  else if (isRecord(value)) Object.values(value).forEach((entry) => collectStrings(entry, output));
  return output;
}
function containsUnsafeEvidence(value) {
  return collectStrings(value).some((entry) => /https?:\/\/|postgres(?:ql)?:\/\//iu.test(entry));
}
function isRecord(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function sameKeys(value, keys) { return JSON.stringify(Object.keys(value)) === JSON.stringify(keys); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function stop(suffix) { return { ok: false, code: `STOP_S2_T162_${suffix}` }; }
