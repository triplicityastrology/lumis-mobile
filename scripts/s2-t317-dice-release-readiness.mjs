#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { validateRelease } from "./lib/s2-t317-final-dice-release.mjs";

const { manifest, seal } = validateRelease();
const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim();
if (branch !== "codex/s2-t317-final-dice-rc") throw new Error("STOP_S2_T317_WRONG_BRANCH");
if (status) throw new Error("STOP_S2_T317_TRACKED_TREE_DIRTY");
console.log(JSON.stringify({
  status: "WAITING_FOR_EXTERNAL_OPERATIONAL_RECEIPTS",
  source_commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  package_sha256: seal.package_sha256,
  required_external_operational_receipts: manifest.required_external_operational_receipts,
  remote_calls: 0,
  provider_calls: 0,
  normal_chat_authority: manifest.normal_chat_authority,
  azure_traffic_authority: manifest.azure_traffic_authority,
}, null, 2));
