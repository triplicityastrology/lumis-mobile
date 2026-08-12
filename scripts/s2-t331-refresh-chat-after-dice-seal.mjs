#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "apps/mobile/src/services/chatAfterDiceRoot.ts",
  "apps/mobile/src/services/chatAfterDiceRoot.fixtures.ts",
  "apps/mobile/tsconfig.chat-after-dice-root-test.json",
  "config/s2-t331-chat-after-dice-root.json",
  "docs/architecture/S2-T331-chat-after-dice-root.md",
  "docs/qa/S2-T331-founder-chat-runbook.md",
  "scripts/run-s2-t331-chat-after-dice-tests.sh",
  "scripts/s2-t331-chat-after-dice-contract.mjs",
  "scripts/s2-t331-chat-after-dice-emulator.mjs",
  "scripts/s2-t331-chat-readiness.mjs",
  "scripts/start-s2-t331-founder-chat-expo.sh",
  "supabase/functions/_shared/chat-after-dice-root-v1.ts",
  "supabase/functions/_shared/chat-after-dice-root-v1.fixtures.ts",
  "supabase/functions/tsconfig.chat-after-dice-root-test.json",
  "supabase/tests/s2-t331-corrected-dice-evidence.schema.json",
  "supabase/tests/s2-t331-chat-default-off-deployment.schema.json",
  "supabase/tests/s2-t331-chat-synthetic-traffic.schema.json",
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const source_sha256 = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const package_sha256 = sha(`${JSON.stringify(source_sha256)}\n`);
const seal = { schema: "s2_t331_chat_after_dice_root_seal_v1", source_sha256, package_sha256 };
const target = "config/s2-t331-chat-after-dice-root-seal.json";
const rendered = `${JSON.stringify(seal, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== rendered) throw new Error("STOP_S2_T331_SEAL_DRIFT");
  console.log(`S2_T331_SEAL_OK package_sha256=${package_sha256}`);
} else {
  writeFileSync(target, rendered);
  console.log(`S2_T331_SEAL_REFRESHED package_sha256=${package_sha256}`);
}
