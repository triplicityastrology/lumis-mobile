import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  EXPECTED_REPOSITORY,
  EXPECTED_WORKFLOW,
  validateGitHubVerificationOutputForTest,
  validatePostgres17CiEvidence,
} from "./lib/care-circle-postgres17-ci-evidence.mjs";

const fixturePath = "supabase/tests/s2-t162-care-circle-postgres17-ci-evidence.valid.json";
const valid = JSON.parse(readFileSync(fixturePath, "utf8"));
const accepted = validatePostgres17CiEvidence(valid);
assert.equal(accepted.ok, true);
if (accepted.ok) assert.match(accepted.evidenceSha256, /^[0-9a-f]{64}$/u);

for (const mutate of [
  (value) => ({ ...value, logs: "proof output" }),
  (value) => ({ ...value, database_host: "private" }),
  (value) => ({ ...value, github: { ...value.github, repository: "untrusted/repo" } }),
  (value) => ({ ...value, github: { ...value.github, ref: "refs/heads/untrusted" } }),
  (value) => ({ ...value, github: { ...value.github, run_id: "0" } }),
  (value) => ({ ...value, github: { ...value.github, run_attempt: 0 } }),
  (value) => ({ ...value, workflow: { ...value.workflow, sha256: "0".repeat(64) } }),
  (value) => ({ ...value, postgres_image: "public.ecr.aws/supabase/postgres:17" }),
  (value) => ({ ...value, migrations: value.migrations.slice(0, 3) }),
  (value) => ({ ...value, assertions: { ...value.assertions, cleanup_confirmed: false } }),
  (value) => ({ ...value, assertions: { ...value.assertions, rollback_passed: false } }),
  (value) => ({ ...value, remote_data_used: true }),
  (value) => ({ ...value, source_url: "https://example.invalid" }),
]) {
  const result = validatePostgres17CiEvidence(mutate(structuredClone(valid)));
  assert.equal(result.ok, false);
  assert.match(result.code, /^STOP_S2_T162_[A-Z0-9_]+$/u);
  assert.doesNotMatch(result.code, /private|example|untrusted/iu);
}

const artifactSha = createHash("sha256").update(readFileSync(fixturePath)).digest("hex");
const verifiedOutput = JSON.stringify([{
  attestation: { digest: "attestation-proof" },
  verificationResult: {
    signature: { certificate: {
      sourceRepository: EXPECTED_REPOSITORY,
      sourceRepositoryRef: valid.github.ref,
      sourceRepositoryDigest: valid.github.commit,
      buildSignerURI: `${EXPECTED_REPOSITORY}/${EXPECTED_WORKFLOW}`,
      buildConfigURI: `actions/runs/${valid.github.run_id}/attempts/${valid.github.run_attempt}`,
      runnerEnvironment: "github-hosted",
    } },
    statement: {
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [{ name: "s2-t162-care-circle-postgres17-proof.json", digest: { sha256: artifactSha } }],
    },
  },
}]);
assert.deepEqual(validateGitHubVerificationOutputForTest(verifiedOutput, valid, artifactSha), { ok: true });
for (const hostile of [
  verifiedOutput.replace(valid.github.run_id, "123"),
  verifiedOutput.replace(valid.github.commit, "0".repeat(40)),
  verifiedOutput.replace("github-hosted", "self-hosted"),
  verifiedOutput.replace(artifactSha, "0".repeat(64)),
]) {
  assert.equal(validateGitHubVerificationOutputForTest(hostile, valid, artifactSha).ok, false);
}

const inert = spawnSync(process.execPath, ["scripts/s2-care-circle-postgres17-ci-evidence.mjs"], { encoding: "utf8" });
assert.equal(inert.status, 0, inert.stderr);
assert.match(inert.stdout, /WAITING_FOR_AUTHORISED_CI_EVIDENCE/);
assert.match(inert.stdout, /staging_ready=false remote_writes_authorized=false/);
const directJson = spawnSync(process.execPath, ["scripts/s2-care-circle-postgres17-ci-evidence.mjs", "--accept", fixturePath], { encoding: "utf8" });
assert.notEqual(directJson.status, 0);
assert.equal(directJson.stderr, "STOP_S2_T162_ARGUMENTS_INVALID\n");

const artifactOutput = "/private/tmp/s2-t162-care-circle-postgres17-proof.json";
if (existsSync(artifactOutput)) unlinkSync(artifactOutput);
const generated = spawnSync(process.execPath, ["scripts/s2-care-circle-postgres17-ci-artifact.mjs", "--write", artifactOutput], {
  encoding: "utf8",
  env: {
    ...process.env,
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: EXPECTED_REPOSITORY,
    GITHUB_REF: valid.github.ref,
    GITHUB_SHA: valid.github.commit,
    GITHUB_RUN_ID: valid.github.run_id,
    GITHUB_RUN_ATTEMPT: String(valid.github.run_attempt),
  },
});
assert.equal(generated.status, 0, generated.stderr);
assert.equal(validatePostgres17CiEvidence(JSON.parse(readFileSync(artifactOutput, "utf8"))).ok, true);
unlinkSync(artifactOutput);

const source = readFileSync("scripts/lib/care-circle-postgres17-ci-evidence.mjs", "utf8");
const cli = readFileSync("scripts/s2-care-circle-postgres17-ci-evidence.mjs", "utf8");
assert.match(source, /gh["], \[\s*"attestation", "verify"/u);
assert.match(source, /--source-digest/u);
assert.match(source, /--signer-digest/u);
assert.match(source, /--deny-self-hosted-runners/u);
assert.match(source, /stop\("ATTESTATION_REPLAY"\)/u);
assert.doesNotMatch(cli, /--accept/u);

console.log("S2-T168 PostgreSQL 17 CI evidence requires verified GitHub artifact provenance.");
