#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  "package.json",
  "config/s2-t277-dice-deployment-authorization.json",
  "docs/qa/S2-T277-dice-default-off-deployment-release.md",
  "scripts/lib/s2-t277-dice-deployment-authorization.mjs",
  "scripts/s2-t277-dice-deployment-authorization.mjs",
  "scripts/s2-t277-remote-deploy-proof.mjs",
  "scripts/run-s2-t277-dice-deployment.zsh",
  "scripts/run-s2-t277-dice-runtime-recheck.zsh",
  "scripts/s2-t277-dice-deployment-release-contract.mjs",
  "scripts/s2-t277-refresh-deployment-seal.mjs",
  "supabase/tests/s2-t277-default-off-deployment-authorization-request.schema.json",
  "supabase/tests/s2-t277-microsoft-default-off-deployment-authorization.schema.json",
  "supabase/tests/s2-t277-dice-deployment-receipt.schema.json",
  "supabase/tests/s2-t277-dice-rollback-receipt.schema.json"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)).map(([path, hash]) => `${path}:${hash}`).join("\n");
const seal = {
  schema: "s2_t277_dice_deployment_package_seal_v1",
  base_commit: "f5f9e9da238633d84eb8695307c573eef8f1bc96",
  base_tree: "666558397b6247ffa54b25ff8ac3f5c64ff5989e",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  authorization_package_sha256: sha256(`${canonical}\n`),
  migration_0039_application_authorized: false,
  provider_calls_authorized: 0,
  model_invocations_authorized: 0,
  files: hashes
};
await writeFile("config/s2-t277-dice-deployment-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`, "utf8");
process.stdout.write(`${seal.authorization_package_sha256}\n`);
