#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { CONTROL_PATH, SEAL_PATH, fileHashes, packageSha, readJson } from "./lib/s2-t312-closed-dice-registry.mjs";

const control = readJson(CONTROL_PATH);
const files = fileHashes();
const seal = {
  schema: "s2_t312_closed_dice_registry_seal_v1",
  package_sha256: packageSha(control, files),
  files
};
writeFileSync(SEAL_PATH, `${JSON.stringify(seal, null, 2)}\n`);
process.stdout.write(`${seal.package_sha256}\n`);
