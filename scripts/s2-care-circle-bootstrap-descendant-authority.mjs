import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { validateBootstrapDescendantAuthority } from "./lib/care-circle-bootstrap-descendant-authority.mjs";

try {
  const control = JSON.parse(readFileSync("supabase/tests/s2-t116-care-circle-bootstrap-descendant-authority.json", "utf8"));
  const head = git("rev-parse", "HEAD");
  const ancestorPresent = spawnSync("git", ["merge-base", "--is-ancestor", control.approved_technical_ancestor, head], { stdio: "ignore" }).status === 0;
  const dirtyPaths = git("status", "--porcelain=v1").split("\n").filter(Boolean).map((line) => line.slice(3));
  const lockedFilesValid = control.locked_operator_files.every((entry) => sha256(entry.path) === entry.sha256);
  validateBootstrapDescendantAuthority({
    ancestorPresent,
    dirtyPaths,
    lockedFilesValid,
    projectRef: control.project_ref,
    origin: control.staging_origin,
    environmentNames: Object.keys(process.env),
  });
  process.stdout.write(`S2_T116_BOOTSTRAP_DESCENDANT_PASS\nproject_ref=${control.project_ref}\napproved_technical_ancestor=${control.approved_technical_ancestor}\nhead=${head}\noperator_files_verified=${control.locked_operator_files.length}\nnetwork_calls=0\n`);
} catch (error) {
  const code = error instanceof Error && /^STOP_S2_T116_[A-Z0-9_]+$/.test(error.message) ? error.message : "STOP_S2_T116_UNKNOWN";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}

function git(...args) { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
