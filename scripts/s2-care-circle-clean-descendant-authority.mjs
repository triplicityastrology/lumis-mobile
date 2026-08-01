import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateCleanDescendantAuthority } from "./lib/care-circle-clean-descendant-authority.mjs";

const control = JSON.parse(readFileSync("supabase/tests/s2-t115-care-circle-descendant-authority.json", "utf8"));
const args = parseArgs(process.argv.slice(2));

try {
  stopUnless(args.projectRef === control.project_ref, "WRONG_PROJECT");
  stopUnless(args.approvedAncestor === control.approved_technical_ancestor, "ANCESTOR_INPUT_MISMATCH");
  const head = git("rev-parse", "HEAD");
  const ancestorPresent = spawnSync("git", ["merge-base", "--is-ancestor", control.approved_technical_ancestor, head], { stdio: "ignore" }).status === 0;
  const dirtyPaths = git("status", "--porcelain=v1").split("\n").filter(Boolean).map((line) => line.slice(3));
  const changedPaths = git("diff", "--name-only", `${control.approved_technical_ancestor}..${head}`).split("\n").filter(Boolean);
  const lockedFilesValid = control.locked_operator_files.every((entry) => sha256(entry.path) === entry.sha256);
  validateCleanDescendantAuthority({ ancestorPresent, dirtyPaths, changedPaths, lockedFilesValid });
  process.stdout.write(`S2_T115_CLEAN_DESCENDANT_PASS\nproject_ref=${control.project_ref}\napproved_technical_ancestor=${control.approved_technical_ancestor}\nhead=${head}\noperator_files_verified=${control.locked_operator_files.length}\nnetwork_calls=0\n`);
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T115_[A-Z0-9_]+$/.test(error.message) ? error.message : "STOP_S2_T115_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function parseArgs(values) {
  const parsed = { projectRef: "", approvedAncestor: "" };
  for (let index = 0; index < values.length; index += 2) {
    if (values[index] === "--project-ref") parsed.projectRef = values[index + 1] ?? "";
    else if (values[index] === "--approved-technical-ancestor") parsed.approvedAncestor = values[index + 1] ?? "";
    else throw new Error("STOP_S2_T115_ARGUMENTS_INVALID");
  }
  return parsed;
}
function git(...args) { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function stopUnless(condition, code) { if (!condition) throw new Error(`STOP_S2_T115_${code}`); }
