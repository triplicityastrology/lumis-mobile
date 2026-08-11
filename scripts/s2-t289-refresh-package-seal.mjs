import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const sha = (data) => createHash("sha256").update(data).digest("hex");
const files = [
  "apps/mobile/index.ts",
  "apps/mobile/src/dev/FounderDiceV4TechnicalEvidenceDashboard.tsx",
  "apps/mobile/src/dev/diceV4TechnicalEvidenceFixture.ts",
  "apps/mobile/src/types/env.d.ts",
  "config/s2-t289-dice-technical-registry-v1.json",
  "config/s2-t289-dice-v4-technical-window.json",
  "docs/qa/S2-T289-dice-v4-technical-window.md",
  "scripts/lib/s2-t289-dice-technical-window.mjs",
  "scripts/s2-t289-dice-mobile-evidence-contract.mjs",
  "scripts/s2-t289-dice-technical-authorization-request.mjs",
  "scripts/s2-t289-dice-technical-window-contract.mjs",
  "scripts/s2-t289-dice-technical-window-emulator.mjs",
  "scripts/s2-t289-dice-technical-window.mjs",
  "scripts/start-s2-t289-dice-evidence-web.sh",
  "supabase/tests/s2-t289-v4-post-deploy-disabled-receipt.schema.json",
  "supabase/tests/s2-t289-t283-migration-receipt.schema.json",
  "supabase/tests/s2-t289-technical-traffic-authorization.schema.json",
  "supabase/tests/s2-t289-technical-evidence-package.schema.json"
];
const hashes = Object.fromEntries(files.map((path) => [path, sha(readFileSync(path))]));
const packageSha256 = sha(Object.entries(hashes).map(([path, digest]) => `${path}:${digest}\n`).join(""));
const manifest = {
  schema: "s2_t289_dice_v4_technical_window_manifest_v1",
  base_commit: "25e48340e7daf0221cc36c71c52300c514b41857",
  deployment_authority_commit: "fc0e516835b2a693344a4e86e558898ee1cf4237",
  deployment_authorization_schema: "lumis_dice_default_off_function_deployment_authorization_v4",
  runtime_package_sha256: "be911dd5f335217b4d00bbce34f0bd27cd9fcdc7c50152b4406b3b3058528457",
  migration_proof_commit: "b469cb7e0824bd6b864edc983bcd352b37994894",
  migration_proof_receipt_sha256: "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e",
  package_sha256: packageSha256,
  mode: "inert_without_three_independent_accepted_receipts",
  files: hashes,
  authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]
};
writeFileSync("config/s2-t289-dice-v4-technical-window-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`S2_T289_SEAL_OK package_sha256=${packageSha256} files=${files.length}`);
