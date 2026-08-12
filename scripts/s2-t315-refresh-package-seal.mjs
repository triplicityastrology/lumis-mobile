#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "config/evidence/s2-t315-accepted-t283-pg17-proof.json",
  "config/s2-t315-authorization-day-control.json",
  "config/s2-t315-exact-t314-candidate.json",
  "config/templates/s2-t315-migration-0039-authorization.template.json",
  "config/templates/s2-t315-technical-80-authorization.template.json",
  "docs/qa/S2-T315-migration-traffic-authorization-day.md",
  "package.json",
  "scripts/lib/s2-t315-authorization-day.mjs",
  "scripts/run-s2-t315-migration-0039.sh",
  "scripts/run-s2-t315-technical-80.sh",
  "scripts/s2-t315-authorization-day-contract.mjs",
  "scripts/s2-t315-migration-0039-operator.mjs",
  "scripts/s2-t315-refresh-package-seal.mjs",
  "scripts/s2-t315-technical-80-operator.mjs",
  "scripts/s2-t315-zero-network-rehearsal.mjs",
  "supabase/tests/s2-t315-migration-0039-authorization.schema.json",
  "supabase/tests/s2-t315-post-action-receipts.schema.json",
  "supabase/tests/s2-t315-technical-80-authorization.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const packageSha = sha(Object.entries(hashes).map(([path, digest]) => `${path}:${digest}\n`).join(""));
writeFileSync("config/s2-t315-authorization-day-package-seal.json", `${JSON.stringify({ schema: "s2_t315_authorization_day_package_seal_v1", base_commit: "519cd6c7cbfe6131f9f35d75d3a0300bc0c676ca", package_sha256: packageSha, files: hashes, authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"] }, null, 2)}\n`);
console.log(packageSha);
