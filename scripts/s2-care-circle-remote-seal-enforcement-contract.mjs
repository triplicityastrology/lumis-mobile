import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateFourDigitSeal } from "./lib/care-circle-four-digit-seal.mjs";

const shellConsumers = [
  "scripts/run-s2-care-circle-pat-deploy.zsh",
  "scripts/run-s2-care-circle-pairing-secret-provision.zsh",
  "scripts/run-s2-care-circle-function-health.zsh",
  "scripts/run-s2-care-circle-bootstrap.zsh",
  "scripts/run-s2-care-circle-two-account-evidence.zsh",
  "scripts/run-s2-care-circle-two-account-operator.sh",
  "scripts/run-s2-care-circle-staging-evidence.sh",
];
const nodeConsumers = [
  "scripts/s2-care-circle-function-health.mjs",
  "scripts/s2-care-circle-two-account-operator.mjs",
  "scripts/s2-care-circle-staging-evidence.mjs",
];
const allConsumers = [...new Set([...shellConsumers, ...nodeConsumers])];
const manifest = validateFourDigitSeal();

for (const path of shellConsumers) {
  const source = readFileSync(path, "utf8");
  const seal = source.indexOf("s2-care-circle-four-digit-seal.mjs --check");
  assert.ok(seal >= 0, `${path} omits seal gate`);
  for (const marker of ["read_hidden", "Paste the", "createClient", "functions deploy", "secrets set", "fetch(", "--execute --action", "writeFileSync("]) {
    const remote = source.indexOf(marker);
    if (remote >= 0) assert.ok(seal < remote, `${path} gates after ${marker}`);
  }
}
for (const path of nodeConsumers) {
  const source = readFileSync(path, "utf8");
  const seal = source.indexOf("validateFourDigitSeal()");
  assert.ok(seal >= 0, `${path} omits seal gate`);
  for (const marker of ["parseArgs(", "parseEvidenceArgs(", "createClient(", "fetch(", "createStagingContext("]) {
    const remote = source.indexOf(marker, source.indexOf("validateFourDigitSeal"));
    if (remote >= 0) assert.ok(seal < remote, `${path} gates after ${marker}`);
  }
}

const temporary = mkdtempSync(join(tmpdir(), "s2-t151-"));
try {
  for (const path of allConsumers) {
    const drifted = structuredClone(manifest);
    const locked = drifted.locked_sources.find((entry) => entry.path === path);
    assert.ok(locked, `manifest omits remote consumer ${path}`);
    locked.sha256 = "0".repeat(64);
    const driftPath = join(temporary, "drift.json");
    writeFileSync(driftPath, JSON.stringify(drifted));
    assert.throws(() => validateFourDigitSeal(driftPath), /STOP_S2_T146_SOURCE_DRIFT/);

    const omitted = structuredClone(manifest);
    omitted.locked_sources = omitted.locked_sources.filter((entry) => entry.path !== path);
    const omittedPath = join(temporary, "omitted.json");
    writeFileSync(omittedPath, JSON.stringify(omitted));
    assert.throws(() => validateFourDigitSeal(omittedPath), /STOP_S2_T146_REQUIRED_SOURCE_MISSING/);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log("S2-T151 remote-capable Care Circle consumers are seal-gated before remote or credential action.");
