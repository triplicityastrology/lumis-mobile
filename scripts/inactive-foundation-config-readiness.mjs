const STAGING_PROJECT_REF = "bmqhwofmdgebpcihjlnb";
const REQUIRED_NAMES = Object.freeze([
  "CARE_CIRCLE_PAIRING_SECRET",
  "NOTIFICATION_TOKEN_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

function readArgument(name) {
  const position = process.argv.indexOf(name);
  return position >= 0 ? process.argv[position + 1] : undefined;
}

function stop(code) {
  console.error(`inactive_foundation_readiness=failed code=${code}`);
  process.exit(1);
}

if (process.argv.includes("--execute")) {
  stop("READINESS_EXECUTION_FORBIDDEN");
}

const projectRef = readArgument("--project-ref");
if (projectRef !== STAGING_PROJECT_REF) {
  stop("READINESS_STAGING_PROJECT_REQUIRED");
}

const suppliedNames = (readArgument("--present-names") ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

if (suppliedNames.some((name) => !REQUIRED_NAMES.includes(name))) {
  stop("READINESS_UNKNOWN_NAME");
}

const presentNames = new Set(suppliedNames);
console.log("inactive_foundation_readiness=local_inert");
console.log(`project_ref=${STAGING_PROJECT_REF}`);
for (const name of REQUIRED_NAMES) {
  console.log(`configuration_name=${name} status=${presentNames.has(name) ? "declared" : "missing"}`);
}
console.log("network_calls=0 configuration_changes=0 provider_activation=0");

if (REQUIRED_NAMES.some((name) => !presentNames.has(name))) {
  stop("READINESS_REQUIRED_NAME_MISSING");
}

console.log("inactive_foundation_readiness=passed");
