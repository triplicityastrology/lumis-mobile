#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { claimOnce, loadBuiltInCandidate, loadControl, validateCandidate, validateDeploymentPostReceipt, validateMigrationPostReceipt, validateTrafficAuthorization, validateTrafficPostReceipt } from "./lib/s2-t315-authorization-day.mjs";

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const readJson = (path, code) => { if (!path) throw new Error(code); return JSON.parse(readFileSync(resolve(path), "utf8")); };
const command = process.argv[2] ?? "status";

try {
  const control = loadControl();
  if (command === "status") {
    const candidate = loadBuiltInCandidate();
    console.log(JSON.stringify({ status: "WAITING_FOR_ACCEPTED_T314_POST_DEPLOY_AND_0039_RECEIPTS_AND_SEPARATE_FOUNDER_TRAFFIC_AUTHORIZATION", scope: control.traffic.scope, candidate_commit: candidate.candidate_commit, candidate_package_sha256: candidate.candidate_package_sha256, next_action: "Import accepted T314 post-deploy and 0039 receipts plus a separately signed Founder 80-only traffic receipt.", remote_calls: 0 }));
    process.exit(2);
  }
  const candidate = arg("--candidate") ? validateCandidate(readJson(arg("--candidate"), "STOP_S2_T315_CANDIDATE_REQUIRED"), control) : loadBuiltInCandidate();
  if (command === "validate-receipt") {
    const accepted = validateTrafficPostReceipt(readJson(arg("--receipt"), "STOP_S2_T315_TRAFFIC_RECEIPT_REQUIRED"), candidate);
    console.log(JSON.stringify({ status: "TECHNICAL_80_POST_ACTION_RECEIPT_ACCEPTED", receipt_sha256: accepted.digest, remote_calls: 0 }));
    process.exit(0);
  }
  const deploymentPath = resolve(arg("--post-deploy-receipt") ?? "");
  const deploymentRaw = readFileSync(deploymentPath);
  const deploymentDigest = (await import("node:crypto")).createHash("sha256").update(deploymentRaw).digest("hex");
  const deployment = validateDeploymentPostReceipt(JSON.parse(deploymentRaw), candidate);
  const migration = validateMigrationPostReceipt(readJson(arg("--migration-receipt"), "STOP_S2_T315_MIGRATION_RECEIPT_REQUIRED"), candidate);
  const publicKey = readFileSync(resolve(arg("--issuer-public-key") ?? ""), "utf8");
  const authorization = readJson(arg("--authorization"), "STOP_S2_T315_TRAFFIC_AUTHORIZATION_REQUIRED");
  const accepted = validateTrafficAuthorization(authorization, candidate, publicKey);
  if (authorization.accepted_post_deploy_receipt_sha256 !== deploymentDigest || authorization.accepted_migration_0039_receipt_sha256 !== migration.digest) throw new Error("STOP_S2_T315_TRAFFIC_PREREQUISITE_MISMATCH");
  if (command === "preflight") {
    console.log(JSON.stringify({ status: "READY_TO_CLAIM_TECHNICAL_80_AUTHORIZATION", authorization_sha256: accepted.digest, run_id: accepted.runId, limits: control.traffic, remote_calls: 0 }));
    process.exit(0);
  }
  if (command === "kill") {
    console.log(JSON.stringify({ status: "KILL_REQUEST_RECORDED_LOCALLY", run_id: accepted.runId, required_remote_action: "Disable LUMIS_DICE_AI_ENABLED and LUMIS_DICE_TRAFFIC_ENABLED through the separately reviewed operator.", remote_calls: 0 }));
    process.exit(0);
  }
  if (command === "emit-t309-receipts") {
    const directory = resolve(arg("--output-dir") ?? "");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const deploymentCompatibility = {
      schema: "s2_t309_accepted_t307_post_deploy_disabled_receipt_v1",
      release_commit: "cf8386a9176ed7fde0b6008a2628c2785bce2c64",
      release_package_sha256: "5eb152dbbf4062b45b9eee78fccfa3aaaadeaa20a0c22f2e9561f1667b4b442f",
      project_ref: "bmqhwofmdgebpcihjlnb",
      function_name: "dice-synthetic",
      deployment_id: deployment.value.deployment_id,
      disabled_probes: deployment.value.disabled_probes,
      provider_calls: 0,
      model_invocations: 0,
      both_switches_false: true,
      migration_applied: false,
      normal_chat_unchanged: true,
      valid_until: authorization.expires_at
    };
    const migrationCompatibility = {
      schema: "s2_t309_accepted_migration_0039_receipt_v1",
      scope: "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY",
      project_ref: "bmqhwofmdgebpcihjlnb",
      migration_version: "0039",
      release_package_sha256: "5eb152dbbf4062b45b9eee78fccfa3aaaadeaa20a0c22f2e9561f1667b4b442f",
      applied: true,
      parity_verified: migration.value.parity_verified,
      rpc_rls_verified: migration.value.rpc_rls_verified,
      cleanup_verified: migration.value.cleanup_verified,
      valid_until: authorization.expires_at
    };
    const trafficCompatibility = {
      schema: "s2_t309_dice_technical_window_80_authorization_v1",
      scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
      decision: "AUTHORIZED",
      run_id: accepted.runId,
      release_commit: "cf8386a9176ed7fde0b6008a2628c2785bce2c64",
      release_package_sha256: "5eb152dbbf4062b45b9eee78fccfa3aaaadeaa20a0c22f2e9561f1667b4b442f",
      deployment_id: deployment.value.deployment_id,
      technical_cases: 80,
      language: { en: 40, "zh-Hant": 40 },
      founder_cases: 0,
      attempt_cap: 160,
      concurrency: 2,
      eligible_retries: 1,
      shared_deadline_ms: 12000,
      input_token_cap: 800,
      output_token_cap: 300,
      tokenizer: "js-tiktoken@1.0.21/o200k_base",
      cost_ceiling_usd: 0.128,
      valid_until: authorization.expires_at
    };
    writeFileSync(`${directory}/deployment.json`, `${JSON.stringify(deploymentCompatibility, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(`${directory}/migration.json`, `${JSON.stringify(migrationCompatibility, null, 2)}\n`, { mode: 0o600 });
    writeFileSync(`${directory}/traffic.json`, `${JSON.stringify(trafficCompatibility, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ status: "T309_COMPATIBILITY_RECEIPTS_WRITTEN_AFTER_FOUNDER_AUTHORITY", output_dir: directory, remote_calls: 0 }));
    process.exit(0);
  }
  if (command !== "claim") throw new Error("STOP_S2_T315_TRAFFIC_USAGE");
  const claim = claimOnce(process.cwd(), "traffic", accepted);
  console.log(JSON.stringify({ status: "TECHNICAL_80_AUTHORIZATION_CLAIMED", claim_path: claim, run_id: accepted.runId, next_action: "Run the T309 controller with finally-disable; this command constructed no provider client.", remote_calls: 0 }));
} catch (error) {
  const code = /^STOP_S2_T315_[A-Z0-9_]+$/u.test(error?.message ?? "") ? error.message : "STOP_S2_T315_TRAFFIC_GATE_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
