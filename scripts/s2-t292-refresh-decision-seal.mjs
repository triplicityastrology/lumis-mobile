#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  "config/s2-t292-dice-v4-decision-control.json",
  "docs/qa/S2-T292-dice-v4-microsoft-decision-packet.md",
  "scripts/lib/s2-t292-dice-v4-decision-packet.mjs",
  "scripts/s2-t292-dice-v4-decision-preflight.mjs",
  "scripts/s2-t292-dice-v4-decision-contract.mjs",
  "scripts/s2-t292-refresh-decision-seal.mjs",
  "supabase/tests/s2-t292-dice-v4-microsoft-decision-packet.schema.json"
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(await Promise.all(files.map(async (path) => [path, sha256(await readFile(path))])));
const canonical = Object.entries(hashes).sort(([left], [right]) => left.localeCompare(right)).map(([path, digest]) => `${path}:${digest}`).join("\n");
const seal = {
  schema: "s2_t292_dice_v4_microsoft_decision_package_seal_v1",
  source_authority_commit: "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  authorization_package_sha256: "ecd7244dbfdce4b31d0df8c5669e3d39eb548a1ffaa47184a1033b28011e61a2",
  decision_packet_sha256: sha256(`${canonical}\n`),
  files: hashes
};
await writeFile("config/s2-t292-dice-v4-decision-package-seal.json", `${JSON.stringify(seal, null, 2)}\n`, "utf8");
process.stdout.write(`${seal.decision_packet_sha256}\n`);
