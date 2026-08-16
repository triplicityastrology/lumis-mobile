#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ACCEPTED_T348_COMMIT = "be92814f6a466fdd56f0fd1e86fd10d5277dbd78";
export const ACCEPTED_T349_COMMIT = "522063abad92d3931aecfc1b9a31e60e8c9f8ce1";
export const INTEGRATED_T356_COMMIT = "fe3f8866b7b8a111a55e216012ce1db06f1735dc";
export const INTEGRATED_T357_COMMIT = "8b93b148e9680ef534f7391b1d2d90d9c7d865a8";
export const INTEGRATED_T358_COMMIT = "017a1b12541abff16229682672129d1cfe2f0f57";
export const AC_DICE_09_HEADINGS = Object.freeze({
  en: Object.freeze(["Reading", "One thing to watch", "Practical step"]),
  "zh-Hant": Object.freeze(["解讀", "需要留意", "實際一步"])
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hex = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const gitCommit = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");

export function validateIntegrationManifest(value) {
  const keys = [
    "schema", "integrated_commit", "t356_commit", "t356_package_sha256", "t357_commit",
    "t357_package_sha256", "t358_commit", "t358_package_sha256", "web_build_marker",
    "mobile_build_marker", "web_launcher", "web_launcher_sha256", "mobile_launcher",
    "mobile_launcher_sha256", "web_url", "mobile_expo_url", "mobile_relay_url",
    "local_consumption_lock"
  ];
  if (!exactKeys(value, keys) || value.schema !== "lumis_s2_t359_integration_manifest_v1") return null;
  if (value.t356_commit !== INTEGRATED_T356_COMMIT || value.t357_commit !== INTEGRATED_T357_COMMIT || value.t358_commit !== INTEGRATED_T358_COMMIT) return null;
  for (const key of ["integrated_commit", "t356_commit", "t357_commit", "t358_commit", "web_build_marker", "mobile_build_marker"]) {
    if (!gitCommit(value[key])) return null;
  }
  for (const key of ["t356_package_sha256", "t357_package_sha256", "t358_package_sha256", "web_launcher_sha256", "mobile_launcher_sha256"]) {
    if (!hex(value[key])) return null;
  }
  if (value.web_build_marker !== value.integrated_commit || value.mobile_build_marker !== value.integrated_commit) return null;
  if (value.web_url !== "http://127.0.0.1:8147") return null;
  if (!/^exp:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)[^:]+:8222$/u.test(value.mobile_expo_url)) return null;
  if (!/^http:\/\/(?:127\.0\.0\.1|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)[^:]*:8223$/u.test(value.mobile_relay_url)) return null;
  if (value.local_consumption_lock !== false) return null;
  for (const key of ["web_launcher", "mobile_launcher"]) {
    if (typeof value[key] !== "string" || path.isAbsolute(value[key]) || value[key].includes("..") || !value[key].startsWith("scripts/")) return null;
  }
  return Object.freeze({ ...value });
}

export function validateProofReceipt(value, manifest, manifestSha256) {
  const keys = ["schema", "integration_manifest_sha256", "local_consumption_lock", "web", "mobile", "human_verdict"];
  if (!exactKeys(value, keys) || value.schema !== "lumis_s2_t359_live_proof_receipt_v1" ||
      value.integration_manifest_sha256 !== manifestSha256 || value.local_consumption_lock !== false ||
      value.human_verdict !== "pending") return false;
  if (!validLane(value.web, "web", manifest.web_build_marker) || !validLane(value.mobile, "mobile", manifest.mobile_build_marker)) return false;
  if (containsForbiddenData(value)) return false;
  return true;
}

function validLane(lane, kind, expectedBuild) {
  const common = ["build_marker", "runs"];
  const expected = kind === "web" ? [...common, "controls", "input_mode"] : [...common, "result_surface"];
  if (!exactKeys(lane, expected) || lane.build_marker !== expectedBuild || !Array.isArray(lane.runs) || lane.runs.length !== 3) return false;
  if (kind === "web") {
    if (lane.input_mode !== "free_text" || !exactKeys(lane.controls, ["question", "planet_count", "sign_count", "house_count", "run", "response"]) ||
        lane.controls.question !== true || lane.controls.planet_count !== 12 || lane.controls.sign_count !== 12 ||
        lane.controls.house_count !== 12 || lane.controls.run !== true || lane.controls.response !== true) return false;
  } else if (!exactKeys(lane.result_surface, ["result_card", "roll_again", "reflect_in_chat"]) ||
      Object.values(lane.result_surface).some((entry) => entry !== true)) return false;
  const languages = new Set();
  const landings = new Set();
  const questions = new Set();
  let sawRetry = false;
  let previousTime = -Infinity;
  for (let index = 0; index < lane.runs.length; index += 1) {
    const run = lane.runs[index];
    const runKeys = ["sequence", "captured_at", "question_sha256", "response_sha256", "language", "landing", "result_schema", "presentation", "outcome", "retry_count"];
    if (!exactKeys(run, runKeys) || run.sequence !== index + 1 || !hex(run.question_sha256) || !hex(run.response_sha256) ||
        (run.language !== "en" && run.language !== "zh-Hant") || run.result_schema !== "lumis_dice_v0_3_result_v2" ||
        run.outcome !== "completed" || !Number.isInteger(run.retry_count) || run.retry_count < 0 || run.retry_count > 1) return false;
    const capturedAt = Date.parse(run.captured_at);
    if (!Number.isFinite(capturedAt) || capturedAt <= previousTime) return false;
    previousTime = capturedAt;
    if (!exactKeys(run.landing, ["planet_id", "sign_id", "house_id"]) ||
        !/^[a-z_]+$/u.test(run.landing.planet_id) || !/^[a-z]+$/u.test(run.landing.sign_id) || !/^house_(?:[1-9]|1[0-2])$/u.test(run.landing.house_id)) return false;
    if (!exactKeys(run.presentation, ["opening_unheaded", "headings"]) || run.presentation.opening_unheaded !== true ||
        JSON.stringify(run.presentation.headings) !== JSON.stringify(AC_DICE_09_HEADINGS[run.language])) return false;
    languages.add(run.language);
    landings.add(`${run.landing.planet_id}:${run.landing.sign_id}:${run.landing.house_id}`);
    questions.add(run.question_sha256);
    sawRetry ||= run.retry_count === 1;
  }
  return languages.size === 2 && landings.size === 3 && questions.size === 3 && (kind !== "mobile" || sawRetry);
}

function containsForbiddenData(value) {
  const forbidden = /(^|_)(question_text|prompt|raw_response|response_text|provider_response|member_id|account_id|device_id|access_token|refresh_token|secret|credential)($|_)/iu;
  if (Array.isArray(value)) return value.some(containsForbiddenData);
  if (!record(value)) return false;
  return Object.entries(value).some(([key, entry]) => forbidden.test(key) || containsForbiddenData(entry));
}

function git(...args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("STOP_S2_T359_GIT_CHECK_FAILED");
  return result.stdout.trim();
}

function assertIntegrated(manifest, manifestPath) {
  if (git("rev-parse", "HEAD") !== manifest.integrated_commit || git("status", "--porcelain", "--untracked-files=no") !== "") {
    throw new Error("STOP_S2_T359_INTEGRATED_TREE_MISMATCH");
  }
  const ancestor = spawnSync("git", ["-C", root, "merge-base", "--is-ancestor", ACCEPTED_T349_COMMIT, "HEAD"]);
  if (ancestor.status !== 0) throw new Error("STOP_S2_T359_REQUIRED_LINEAGE_MISSING");
  for (const commit of [ACCEPTED_T348_COMMIT, manifest.t356_commit, manifest.t357_commit, manifest.t358_commit]) {
    const result = spawnSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`]);
    if (result.status !== 0) throw new Error("STOP_S2_T359_INTEGRATION_INPUT_MISSING");
  }
  for (const [file, expected] of [[manifest.web_launcher, manifest.web_launcher_sha256], [manifest.mobile_launcher, manifest.mobile_launcher_sha256]]) {
    const resolved = realpathSync(path.join(root, file));
    if (!resolved.startsWith(`${root}${path.sep}`) || sha(readFileSync(resolved)) !== expected) throw new Error("STOP_S2_T359_LAUNCHER_DRIFT");
  }
  return sha(readFileSync(manifestPath));
}

function loadJson(file) {
  return JSON.parse(readFileSync(realpathSync(file), "utf8"));
}

async function main() {
  const [command = "preflight", manifestPath, receiptPath] = process.argv.slice(2);
  if (!manifestPath) throw new Error("STOP_S2_T359_INTEGRATION_MANIFEST_REQUIRED");
  const manifest = validateIntegrationManifest(loadJson(manifestPath));
  if (!manifest) throw new Error("STOP_S2_T359_INTEGRATION_MANIFEST_INVALID");
  const manifestSha256 = assertIntegrated(manifest, manifestPath);
  if (command === "preflight") {
    process.stdout.write(`S2_T359_INTEGRATION_READY\nintegrated_commit=${manifest.integrated_commit}\nmanifest_sha256=${manifestSha256}\nnext=launch_web_then_mobile\n`);
    return;
  }
  if (command !== "verify" || !receiptPath) throw new Error("STOP_S2_T359_COMMAND_INVALID");
  if (!validateProofReceipt(loadJson(receiptPath), manifest, manifestSha256)) throw new Error("STOP_S2_T359_PROOF_INVALID");
  process.stdout.write(`S2_T359_LIVE_PROOF_VALID\nintegrated_commit=${manifest.integrated_commit}\nmanifest_sha256=${manifestSha256}\nhuman_verdict=pending\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error && /^STOP_S2_T359_[A-Z0-9_]+$/u.test(error.message) ? error.message : "STOP_S2_T359_UNSAFE_FAILURE";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
