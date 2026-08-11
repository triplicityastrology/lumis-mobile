import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const CORE_FILES = [
  "package.json",
  "pnpm-lock.yaml",
  "config/evidence/s2-t262-azure-foundry-api-route-family-v1.json",
  "config/evidence/s2-t262-azure-foundry-deployment-readonly-v1.json",
  "config/evidence/s2-t262-azure-foundry-sanitized-price-v1.json",
  "config/s2-t262-dice-technical-registry-v1.json",
  "scripts/lib/s2-t259-dice-authorization-operator.mjs",
  "scripts/lib/s2-t259-durable-deployment-claim.mjs",
  "scripts/s2-t259-dice-authorization-operator.mjs",
  "scripts/s2-t267-wrapper-ledger-integration.mjs",
  "supabase/functions/_shared/azure-dice-adapter-v1.ts",
  "supabase/functions/_shared/dice-authority-store-v1.ts",
  "supabase/functions/_shared/dice-synthetic-canonical-v1.ts",
  "supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts",
  "supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts",
  "supabase/functions/_shared/dice-tokenizer-v1.ts",
  "supabase/functions/dice-synthetic/deno.json",
  "supabase/functions/dice-synthetic/index.ts",
  "supabase/migrations/0039_dice_synthetic_authority_ledger.sql",
  "supabase/tests/lumis-dice-default-off-deployment-authorization-v2.schema.json",
  "supabase/tests/lumis-dice-synthetic-result-v1.schema.json"
];

const digest = (value) => createHash("sha256").update(value).digest("hex");
const hashes = Object.fromEntries(CORE_FILES.sort().map((file) => [file, digest(readFileSync(file))]));
const packageSha256 = digest(Object.entries(hashes).map(([file, hash]) => `${file}\0${hash}`).join("\n"));

const handlerPath = "supabase/functions/dice-synthetic/edge-handler-v1.ts";
const handler = readFileSync(handlerPath, "utf8").replace(
  /DICE_EDGE_PACKAGE_SHA256 = "[a-f0-9]{64}"/,
  `DICE_EDGE_PACKAGE_SHA256 = "${packageSha256}"`,
);
writeFileSync(handlerPath, handler);

const registrySha256 = digest(readFileSync("supabase/functions/_shared/dice-synthetic-fixture-registry-v0-3.ts"));
const controlPath = "config/s2-t259-dice-authorization-control.json";
const control = JSON.parse(readFileSync(controlPath, "utf8"));
control.canonical_sha256 = {
  gateway: digest(readFileSync("supabase/functions/_shared/dice-synthetic-gateway-port-v1.ts")),
  registry: registrySha256,
  registry_payload: JSON.parse(readFileSync("config/s2-t262-dice-technical-registry-v1.json", "utf8")).registry_payload_sha256,
  adapter: digest(readFileSync("supabase/functions/_shared/azure-dice-adapter-v1.ts")),
  response_schema: digest(readFileSync("supabase/tests/lumis-dice-synthetic-result-v1.schema.json")),
  operator: digest(readFileSync("scripts/lib/s2-t259-dice-authorization-operator.mjs")),
};
control.source_seal.files = hashes;
control.source_seal.package_sha256 = packageSha256;
control.configuration_names = [
  "LUMIS_DICE_AI_ENABLED", "LUMIS_DICE_TRAFFIC_AUTHORIZED", "LUMIS_DICE_AZURE_API_KEY",
  "LUMIS_DICE_AUTHORITY_HMAC_SECRET", "LUMIS_DICE_DEPLOYMENT_ALIAS", "LUMIS_DICE_MODEL",
  "LUMIS_DICE_MODEL_VERSION", "LUMIS_DICE_DEPLOYMENT_TYPE", "LUMIS_DICE_UPGRADE_POLICY",
  "LUMIS_DICE_GUARDRAIL", "LUMIS_DICE_TPM_LIMIT", "LUMIS_DICE_RPM_LIMIT",
  "LUMIS_DICE_FOUNDRY_HOSTNAME", "LUMIS_DICE_FOUNDRY_PROTOCOL", "LUMIS_DICE_API_ROUTE_FAMILY"
];
writeFileSync(controlPath, `${JSON.stringify(control, null, 2)}\n`);

const canonicalPath = "config/s2-t257-canonical-dice-gateway-manifest.json";
const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
canonical.fixture_registry_sha256 = registrySha256;
canonical.package_sha256 = packageSha256;
canonical.package_files = hashes;
writeFileSync(canonicalPath, `${JSON.stringify(canonical, null, 2)}\n`);

const authorityPath = "config/s2-t263-dice-edge-authority.json";
const authority = JSON.parse(readFileSync(authorityPath, "utf8"));
authority.canonical_package_sha256 = packageSha256;
writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`);

const releasePath = "config/s2-t267-dice-edge-release.json";
const release = JSON.parse(readFileSync(releasePath, "utf8"));
release.package_sha256 = packageSha256;
release.registry_sha256 = registrySha256;
release.files = Object.fromEntries([
  ...Object.entries(hashes),
  [handlerPath, digest(readFileSync(handlerPath))],
  [canonicalPath, digest(readFileSync(canonicalPath))],
  [controlPath, digest(readFileSync(controlPath))],
  [authorityPath, digest(readFileSync(authorityPath))],
].sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
console.log(JSON.stringify({ status: "S2_T267_SEAL_REFRESHED", package_sha256: packageSha256, files: Object.keys(release.files).length }));
