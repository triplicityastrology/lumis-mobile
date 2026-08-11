#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  "config/s2-t298-dice-v4-zero-call-control.json",
  "config/evidence/s2-t298-dice-v4-zero-call-runtime-proof.json",
  "docs/qa/S2-T298-dice-v4-zero-call-preflight.md",
  "scripts/lib/s2-t298-dice-v4-zero-call.mjs",
  "scripts/run-s2-t298-dice-v4-zero-call-deployment.zsh",
  "scripts/s2-t298-dice-v4-review-request.mjs",
  "scripts/s2-t298-dice-v4-zero-call-preflight.mjs",
  "scripts/s2-t298-dice-v4-zero-call-contract.mjs",
  "scripts/s2-t298-post-deploy-receipt.mjs",
  "scripts/s2-t298-refresh-zero-call-seal.mjs",
  "supabase/tests/s2-t298-dice-v4-zero-call-post-deploy-receipt.schema.json"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t298_dice_v4_zero_call_package_seal_v1",
  base_commit: "f1288d6159d23317f6f4db05bcf194bc93af65d6",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  authorization_package_sha256: "53f5cbc0552a30016c8b6c8fb827740bbafcdedd1a36146092fd469b11ba7799",
  package_sha256: sha256(`${canonical}\n`),
  files: hashes
};
await writeFile("config/s2-t298-dice-v4-zero-call-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`, "utf8");
process.stdout.write(`${seal.package_sha256}\n`);
