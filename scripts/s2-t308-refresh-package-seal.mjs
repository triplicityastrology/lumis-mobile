#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const files = [
  "config/s2-t308-v4-receipt-deployment-day-control.json",
  "config/s2-t313-founder-signer-trust-anchor.json",
  "config/evidence/s2-t313-founder-key-generation-receipt.json",
  "docs/qa/S2-T308-v4-receipt-deployment-day.md",
  "scripts/lib/s2-t308-v4-receipt-deployment-day.mjs",
  "scripts/lib/s2-t313-founder-trust-anchor.mjs",
  "scripts/s2-t308-v4-receipt-intake.mjs",
  "scripts/run-s2-t308-v4-deployment-day.zsh",
  "scripts/s2-t308-v4-receipt-deployment-day-contract.mjs",
  "scripts/s2-t308-refresh-package-seal.mjs"
];
const digests = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(digests).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t308_v4_receipt_deployment_day_package_seal_v1",
  base_commit: "85f6e308a752393105eac99216f79df5e18c8a20",
  package_sha256: sha256(`${canonical}\n`),
  files: digests
};
await writeFile("config/s2-t308-v4-receipt-deployment-day-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`);
process.stdout.write(`${seal.package_sha256}\n`);
