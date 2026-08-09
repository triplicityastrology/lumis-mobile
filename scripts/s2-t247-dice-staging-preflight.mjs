import assert from "node:assert/strict";

const EXPECTED_PROJECT = "bmqhwofmdgebpcihjlnb";
const mode = process.argv[2] ?? "--check";

if (mode === "--check") {
  console.log(JSON.stringify({
    status: "READY_SOURCE_ONLY_NO_TRAFFIC",
    enabled_default: false,
    deployment_performed: false,
    provider_calls: 0,
    next_action: "MICROSOFT_TECHNICAL_REVIEW"
  }));
  process.exit(0);
}
assert.equal(mode, "--deployment-preflight", "unknown mode");
const present = (name) => typeof process.env[name] === "string" && process.env[name].length > 0;
if (process.env.SUPABASE_PROJECT_REF !== EXPECTED_PROJECT) stop("STOP_S2_T247_WRONG_PROJECT");
if (process.env.LUMIS_AI_ENABLED !== "false") stop("STOP_S2_T247_AI_NOT_PROVEN_DISABLED");
if (present("EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT") || present("EXPO_PUBLIC_AZURE_OPENAI_API_KEY") || present("EXPO_PUBLIC_LUMIS_AI_MODEL")) {
  stop("STOP_S2_T247_CLIENT_PROVIDER_CONFIGURATION_PRESENT");
}
if (!present("SUPABASE_ACCESS_TOKEN")) stop("STOP_S2_T247_STAGING_AUTHORITY_UNAVAILABLE");

console.log(JSON.stringify({
  status: "READY_FOR_SEPARATELY_AUTHORIZED_DEFAULT_OFF_DEPLOYMENT",
  project_ref: EXPECTED_PROJECT,
  lumis_ai_enabled: false,
  credential_values_observed: false,
  deployment_performed: false,
  provider_calls: 0
}));

function stop(code) {
  console.log(JSON.stringify({ status: code, deployment_performed: false, provider_calls: 0 }));
  process.exit(2);
}
