#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { CONTROL_PATH, SEAL_PATH, fileHashes, packageSha, readJson } from "./lib/s2-t307-dice-release-candidate.mjs";

const control = readJson(CONTROL_PATH);
const files = fileHashes();
const seal = {
  schema: "s2_t307_dice_release_candidate_seal_v1",
  package_sha256: packageSha(control, files),
  source_binding: "clean_git_head_plus_exact_selected_file_hashes",
  files
};
writeFileSync(SEAL_PATH, `${JSON.stringify(seal, null, 2)}\n`);
process.stdout.write(`${seal.package_sha256}\n`);
