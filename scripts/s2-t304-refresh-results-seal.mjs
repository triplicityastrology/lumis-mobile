import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "config/s2-t304-dice-80-results.json",
  "docs/qa/S2-T304-dice-technical-results.md",
  "package.json",
  "scripts/lib/s2-t304-dice-80-results.mjs",
  "scripts/s2-t304-dice-80-results.mjs",
  "scripts/s2-t304-dice-80-results-contract.mjs",
  "scripts/s2-t304-dice-80-results-emulator.mjs",
  "supabase/tests/s2-t304-dice-technical-results-review.schema.json",
  "supabase/tests/s2-t304-zero-network-rehearsal-receipt.schema.json"
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const packageInput = Object.entries(hashes).map(([path, digest]) => `${path}:${digest}\n`).join("");
const manifest = { schema: "s2_t304_dice_80_results_manifest_v1", base_commit: "8028dd5adc2282f284f037e3db10aaf9827c0e65", package_sha256: sha(packageInput), execution_mode: "inert_without_three_independently_accepted_receipts", local_rehearsal_is_live_proof: false, files: hashes, authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"] };
writeFileSync("config/s2-t304-dice-80-results-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`S2_T304_RESULTS_SEAL_REFRESHED ${manifest.package_sha256}`);
