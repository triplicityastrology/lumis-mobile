import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CONTROL_PATH =
  "supabase/tests/s2-t43-care-circle-function-pat-control.json";
const LINKED_REF_PATH = "supabase/.temp/project-ref";
const FUNCTION_PATH = "supabase/functions/care-circle/index.ts";

const args = parseArgs(process.argv.slice(2));
const control = JSON.parse(readFileSync(CONTROL_PATH, "utf8"));

assert.equal(
  args.projectRef,
  control.project_ref,
  "PAT_PREFLIGHT_PROJECT_REF_MISMATCH"
);
const authority = JSON.parse(readFileSync("supabase/tests/s2-t115-care-circle-descendant-authority.json", "utf8"));
assert.equal(args.approvedTechnicalAncestor, authority.approved_technical_ancestor, "PAT_PREFLIGHT_ANCESTOR_INPUT_MISMATCH");
assert.equal(
  process.env.SUPABASE_ACCESS_TOKEN,
  undefined,
  "PAT_PREFLIGHT_TOKEN_MUST_NOT_BE_SET"
);
if (existsSync(LINKED_REF_PATH)) {
  assert.equal(
    readFileSync(LINKED_REF_PATH, "utf8").trim(),
    control.project_ref,
    "PAT_PREFLIGHT_LINKED_REF_MISMATCH"
  );
}

const head = git("rev-parse", "HEAD");
const descendant = spawnSync(process.execPath, [
  "scripts/s2-care-circle-clean-descendant-authority.mjs",
  "--project-ref", args.projectRef,
  "--approved-technical-ancestor", args.approvedTechnicalAncestor,
], { encoding: "utf8" });
assert.equal(descendant.status, 0, "PAT_PREFLIGHT_DESCENDANT_AUTHORITY_FAILED");
assert.equal(
  git("merge-base", "--is-ancestor", control.minimum_safe_function_commit, head),
  "",
  "PAT_PREFLIGHT_UNSAFE_FUNCTION_ANCESTRY"
);

const functionChecksum = createHash("sha256")
  .update(readFileSync(FUNCTION_PATH))
  .digest("hex");
assert.equal(
  functionChecksum,
  control.function_sha256,
  "PAT_PREFLIGHT_FUNCTION_CHECKSUM_MISMATCH"
);
for (const supporting of control.supporting_files ?? []) {
  const checksum = createHash("sha256")
    .update(readFileSync(supporting.path))
    .digest("hex");
  assert.equal(
    checksum,
    supporting.sha256,
    "PAT_PREFLIGHT_FUNCTION_CHECKSUM_MISMATCH"
  );
}

assert.equal(control.execution_default, "local_validation_only");
assert.equal(control.supabase_cli_version, "2.109.1");
assert.equal(control.function_name, "care-circle");
assert.deepEqual(control.minimum_permissions, [
  "edge_functions_read",
  "edge_functions_write"
]);

process.stdout.write(
  [
    "S2-T43 local PAT preflight passed.",
    `project_ref=${control.project_ref}`,
    `approved_technical_ancestor=${args.approvedTechnicalAncestor}`,
    `head=${head}`,
    `function_sha256=${functionChecksum}`,
    "network_contact=false",
    "token_requested=false"
  ].join("\n") + "\n"
);

function git(...gitArgs) {
  return execFileSync("git", gitArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (flag === "--project-ref") result.projectRef = value;
    if (flag === "--approved-technical-ancestor") result.approvedTechnicalAncestor = value;
  }
  if (!result.projectRef || !result.approvedTechnicalAncestor || values.length !== 4) {
    throw new Error("PAT_PREFLIGHT_ARGUMENTS_INVALID");
  }
  return result;
}
