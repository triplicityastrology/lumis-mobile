#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import {
  MANIFEST_PATH,
  SEAL_PATH,
  packageSha256,
  readJson,
  sealedFileHashes,
} from "./lib/s2-t317-final-dice-release.mjs";

const manifest = readJson(MANIFEST_PATH);
const files = sealedFileHashes();
const seal = {
  schema: "s2_t317_final_dice_release_seal_v1",
  files,
  package_sha256: packageSha256(manifest, files),
};
writeFileSync(SEAL_PATH, `${JSON.stringify(seal, null, 2)}\n`, { encoding: "utf8", mode: 0o644 });
console.log(seal.package_sha256);
