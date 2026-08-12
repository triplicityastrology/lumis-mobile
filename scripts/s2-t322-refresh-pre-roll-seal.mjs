#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { CONTROL_PATH, SEAL_PATH, fileHashes, packageSha, readJson } from "./lib/s2-t322-real-dice-pre-roll-validation.mjs";

const control = readJson(CONTROL_PATH);
const files = fileHashes();
const seal = { schema: "s2_t322_real_dice_pre_roll_validation_seal_v1", files, package_sha256: packageSha(control, files) };
writeFileSync(SEAL_PATH, `${JSON.stringify(seal, null, 2)}\n`);
console.log(seal.package_sha256);
