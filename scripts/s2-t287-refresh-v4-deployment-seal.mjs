#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  "package.json",
  "config/s2-t287-dice-v4-deployment-control.json",
  "config/evidence/s2-t287-dice-runtime-recheck.json",
  "docs/qa/S2-T287-canonical-v4-dice-deployment.md",
  "scripts/lib/s2-t287-dice-v4-deployment-authorization.mjs",
  "scripts/s2-t287-dice-v4-deployment-authorization.mjs",
  "scripts/s2-t287-remote-deploy-proof.mjs",
  "scripts/run-s2-t287-dice-deployment.zsh",
  "scripts/s2-t287-dice-v4-deployment-contract.mjs",
  "scripts/s2-t287-refresh-v4-deployment-seal.mjs",
  "supabase/tests/s2-t287-default-off-deployment-authorization-request-v4.schema.json",
  "supabase/tests/s2-t287-founder-default-off-deployment-authorization-v4.schema.json",
  "supabase/tests/s2-t287-dice-deployment-receipt.schema.json",
  "supabase/tests/s2-t287-dice-rollback-receipt.schema.json"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t287_dice_v4_deployment_package_seal_v1",
  base_commit: "fc0e516835b2a693344a4e86e558898ee1cf4237",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  authorization_package_sha256: sha256(`${canonical}\n`),
  authorization_clock: {
    policy: "SIGNED_RECEIPT_ISSUED_AT_PLUS_RELATIVE_WINDOW",
    window_seconds: 900
  },
  migration_0039_application_authorized: false,
  provider_calls_authorized: 0,
  model_invocations_authorized: 0,
  files: hashes
};
await writeFile("config/s2-t287-dice-v4-deployment-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`, "utf8");
process.stdout.write(`${seal.authorization_package_sha256}\n`);
