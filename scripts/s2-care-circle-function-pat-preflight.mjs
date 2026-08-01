import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
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
assert.match(args.approvedSourceSha, /^[0-9a-f]{40}$/);
assert.equal(
  process.env.SUPABASE_ACCESS_TOKEN,
  undefined,
  "PAT_PREFLIGHT_TOKEN_MUST_NOT_BE_SET"
);
assert.equal(
  existsSync(LINKED_REF_PATH),
  true,
  "PAT_PREFLIGHT_LINKED_REF_MISSING"
);
assert.equal(
  readFileSync(LINKED_REF_PATH, "utf8").trim(),
  control.project_ref,
  "PAT_PREFLIGHT_LINKED_REF_MISMATCH"
);

const head = git("rev-parse", "HEAD");
assert.equal(head, args.approvedSourceSha, "PAT_PREFLIGHT_SOURCE_SHA_MISMATCH");
assert.equal(git("status", "--porcelain=v1"), "", "PAT_PREFLIGHT_TREE_DIRTY");
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
    `source_sha=${head}`,
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
    if (flag === "--approved-source-sha") result.approvedSourceSha = value;
  }
  if (!result.projectRef || !result.approvedSourceSha || values.length !== 4) {
    throw new Error("PAT_PREFLIGHT_ARGUMENTS_INVALID");
  }
  return result;
}
