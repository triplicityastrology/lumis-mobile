#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import {
  MANIFEST_PATH,
  SEALED_FILES,
  SEAL_PATH,
  buildManifest,
  fileHashes,
  packageSha,
} from "./lib/s2-t327-canonical-dice-release-root.mjs";

const manifest = buildManifest();
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
const files = fileHashes(SEALED_FILES);
const seal = {
  schema: "s2_t327_canonical_dice_release_root_seal_v1",
  files,
  package_sha256: packageSha(manifest, files),
};
writeFileSync(SEAL_PATH, `${JSON.stringify(seal, null, 2)}\n`);
process.stdout.write(`${seal.package_sha256}\n`);
