#!/usr/bin/env node
// Identity-receipt generator (OPERATOR ONLY) — run AFTER the final commit exists.
//
// Mints the immutable executable-identity receipt for scope
// FOUNDER_INTERNAL_CHAT_LAB_FREE_TEXT_STAGING and writes it to $LAB_IDENTITY_RECEIPT_PATH.
// It binds the CURRENT clean runtime: final commit + final tree + source-complete package checksum
// + the fixed bindings (reviewer/environment/prompt/azure/disable-control). It refuses to run
// against a dirty worktree, so there is no commit self-reference (the receipt is generated only
// once the tree it certifies is already committed and clean).
//
// The receipt MUST be written OUTSIDE the tracked worktree (e.g. an absolute path in /tmp), or the
// untracked file would make the runtime worktree "dirty" and fail verification. The server then
// loads + verifies this receipt (never mints its own).
//
//   LAB_IDENTITY_RECEIPT_PATH=/absolute/out/identity-receipt.json \
//     node internal/companion-web-ai-lab/scripts/mint-identity-receipt.mjs

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const labDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(labDir, "..", "..");

const out = (process.env.LAB_IDENTITY_RECEIPT_PATH ?? "").trim();
if (!out) {
  console.error("LAB_IDENTITY_RECEIPT_PATH is required (absolute path OUTSIDE the tracked worktree).");
  process.exit(2);
}
if (out.startsWith(root + path.sep) && !out.includes(`${path.sep}.tmp${path.sep}`)) {
  console.error(`Refusing to write the receipt inside the tracked worktree (${out}). Use a path outside ${root} (or under .tmp/).`);
  process.exit(2);
}

// Compile the Lab so we can reuse the exact runtime identity logic (no re-implementation here).
execSync(`"${root}/node_modules/.bin/tsc" -p "${labDir}/tsconfig.json"`, { stdio: "inherit" });
const identity = require(path.join(root, ".tmp/companion-web-ai-lab/internal/companion-web-ai-lab/src/lab-identity.js"));

let receipt;
try {
  receipt = identity.mintIdentityReceipt(); // real runtime; throws LAB_IDENTITY_WORKTREE_DIRTY if not clean
} catch (e) {
  console.error(`Cannot mint receipt: ${e.message}`);
  if (String(e.message).includes("WORKTREE_DIRTY")) console.error("Commit the final tree first, then re-run (no commit self-reference).");
  process.exit(1);
}

writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n", { encoding: "utf8" });
console.log(`Identity receipt written: ${out}`);
console.log(`  scope            ${receipt.scope}`);
console.log(`  final_commit     ${receipt.final_commit}`);
console.log(`  final_tree       ${receipt.final_tree}`);
console.log(`  package_checksum ${receipt.package_checksum}`);
console.log(`  prompt_version   ${receipt.prompt_version}`);
console.log(`  azure_deployment ${receipt.azure_deployment}`);
console.log(`  receipt_checksum ${receipt.receipt_checksum}`);
console.log("\nSet LAB_IDENTITY_RECEIPT_PATH to this file when starting the Lab to authorize the provider path.");
