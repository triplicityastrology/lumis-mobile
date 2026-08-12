#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { claimOnce, loadBuiltInCandidate, loadControl, validateCandidate, validateMigrationAuthorization, validateMigrationPostReceipt, validateProofRecord } from "./lib/s2-t315-authorization-day.mjs";

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const readJson = (path, code) => { if (!path) throw new Error(code); return JSON.parse(readFileSync(resolve(path), "utf8")); };
const command = process.argv[2] ?? "status";

try {
  const control = loadControl();
  const proof = validateProofRecord();
  if (command === "status") {
    const candidate = loadBuiltInCandidate();
    console.log(JSON.stringify({ status: "WAITING_FOR_SEPARATE_FOUNDER_MIGRATION_AUTHORIZATION", scope: control.migration.scope, candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, proof_receipt_sha256: proof.proof_receipt_sha256, next_action: "Supply the Founder public key and separately signed migration-only receipt.", remote_calls: 0 }));
    process.exit(2);
  }
  const candidate = arg("--candidate") ? validateCandidate(readJson(arg("--candidate"), "STOP_S2_T315_CANDIDATE_REQUIRED"), control) : loadBuiltInCandidate();
  if (command === "validate-receipt") {
    const accepted = validateMigrationPostReceipt(readJson(arg("--receipt"), "STOP_S2_T315_MIGRATION_RECEIPT_REQUIRED"), candidate);
    console.log(JSON.stringify({ status: "MIGRATION_0039_POST_ACTION_RECEIPT_ACCEPTED", receipt_sha256: accepted.digest, remote_calls: 0 }));
    process.exit(0);
  }
  const publicKey = readFileSync(resolve(arg("--issuer-public-key") ?? ""), "utf8");
  const authorization = readJson(arg("--authorization"), "STOP_S2_T315_MIGRATION_AUTHORIZATION_REQUIRED");
  const expectedAction = arg("--action");
  if (!expectedAction) throw new Error("STOP_S2_T315_MIGRATION_ACTION_REQUIRED");
  const accepted = validateMigrationAuthorization(authorization, candidate, publicKey, Date.now(), expectedAction);
  if (command === "preflight") {
    console.log(JSON.stringify({ status: "READY_TO_CLAIM_SEPARATE_MIGRATION_0039_AUTHORIZATION", authorization_sha256: accepted.digest, scope: accepted.scope, remote_calls: 0 }));
    process.exit(0);
  }
  if (command !== "claim") throw new Error("STOP_S2_T315_MIGRATION_USAGE");
  const claim = claimOnce(process.cwd(), "migration", accepted);
  console.log(JSON.stringify({ status: "MIGRATION_0039_AUTHORIZATION_CLAIMED", claim_path: claim, next_action: "Run the separately reviewed migration executor; this command performed no remote action.", remote_calls: 0 }));
} catch (error) {
  const code = /^STOP_S2_T315_[A-Z0-9_]+$/u.test(error?.message ?? "") ? error.message : "STOP_S2_T315_MIGRATION_GATE_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
