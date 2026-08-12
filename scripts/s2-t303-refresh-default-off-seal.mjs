#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  "config/s2-t303-dice-default-off-final-control.json",
  "docs/qa/S2-T303-dice-default-off-final.md",
  "scripts/lib/s2-t303-dice-default-off-final.mjs",
  "scripts/run-s2-t303-dice-default-off-deployment.zsh",
  "scripts/s2-t303-dice-default-off-preflight.mjs",
  "scripts/s2-t303-dice-default-off-contract.mjs",
  "scripts/s2-t303-refresh-default-off-seal.mjs"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t303_dice_default_off_final_package_seal_v1",
  base_commit: "69c3de399acf3fa9ec746deaeb7a1880128955ca",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  authorization_package_sha256: "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2",
  package_sha256: sha256(`${canonical}\n`),
  files: hashes
};
await writeFile("config/s2-t303-dice-default-off-final-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`, "utf8");
process.stdout.write(`${seal.package_sha256}\n`);
