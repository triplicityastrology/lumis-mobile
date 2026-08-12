#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/src/dev/founderDiceQuestionBank.ts",
  "apps/mobile/src/features/dice/DiceRitualScreen.tsx",
  "apps/mobile/src/services/diceFounderFixtureRegistry.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.ts",
  "apps/mobile/src/services/diceLiveResultAdapter.fixtures.ts",
  "config/s2-t307-dice-release-candidate-seal.json",
  "config/s2-t314-final-disabled-deploy-control.json",
  "config/s2-t314-founder-fixture-registry.json",
  "scripts/lib/s2-t314-final-disabled-deploy.mjs",
  "scripts/run-s2-t314-final-disabled-deploy.zsh",
  "scripts/s2-t314-final-disabled-deploy.mjs",
  "scripts/s2-t314-generate-founder-registry.mjs",
  "supabase/functions/_shared/dice-tokenizer-v1.ts",
  "supabase/functions/dice-synthetic/deno.json",
  "supabase/functions/dice-synthetic/index.ts",
  "supabase/tests/s2-t314-founder-deployment-authorization.schema.json",
  "supabase/tests/s2-t314-founder-deployment-request.schema.json",
  "supabase/tests/s2-t314-zero-call-post-deploy-receipt.schema.json"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(files.map((path) => [path, sha256(readFileSync(path))]));
const canonical = Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t314_final_disabled_deploy_package_seal_v1",
  base_commit: "cf8386a9176ed7fde0b6008a2628c2785bce2c64",
  package_sha256: sha256(`${canonical}\n`),
  files: hashes
};
writeFileSync("config/s2-t314-final-disabled-deploy-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`);
process.stdout.write(`${seal.package_sha256}\n`);
