#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/src/services/chatAfterDiceProductCandidate.ts",
  "apps/mobile/src/services/chatAfterDiceProductCandidate.fixtures.ts",
  "apps/mobile/tsconfig.chat-after-dice-product-test.json",
  "config/s2-t336-chat-after-dice-product.json",
  "docs/architecture/S2-T336-chat-after-dice-product-candidate.md",
  "docs/qa/S2-T336-founder-ssd-chat-runbook.md",
  "scripts/run-s2-t336-chat-after-dice-product-tests.sh",
  "scripts/s2-t336-chat-after-dice-product-contract.mjs",
  "scripts/s2-t336-chat-after-dice-emulator.mjs",
  "scripts/s2-t336-chat-readiness.mjs",
  "scripts/start-s2-t336-founder-chat-expo.sh",
  "scripts/start-s2-t336-founder-chat-simulator.sh",
  "supabase/tests/s2-t336-explicit-reflect-payload.schema.json",
  "supabase/tests/s2-t336-final-dice-evidence-binding.schema.json",
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const source_sha256 = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const package_sha256 = sha(`${JSON.stringify(source_sha256)}\n`);
const seal = { schema: "s2_t336_chat_after_dice_product_seal_v1", source_sha256, package_sha256 };
const target = "config/s2-t336-chat-after-dice-product-seal.json";
const rendered = `${JSON.stringify(seal, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== rendered) throw new Error("STOP_S2_T336_SEAL_DRIFT");
  console.log(`S2_T336_SEAL_OK package_sha256=${package_sha256}`);
} else {
  writeFileSync(target, rendered);
  console.log(`S2_T336_SEAL_REFRESHED package_sha256=${package_sha256}`);
}
