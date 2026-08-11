import process from "node:process";

const options = parseArguments(process.argv.slice(2));
if (options.disabledCode !== "DICE_AI_DISABLED") stop("STOP_S2_T263_DISABLED_PROBE_NOT_VERIFIED");
if (options.providerCalls !== 0) stop("STOP_S2_T263_PROVIDER_CALLS_NONZERO");
if (!Number.isFinite(Date.parse(options.observedAt))) stop("STOP_S2_T263_OBSERVED_AT_INVALID");

process.stdout.write(`${JSON.stringify({
  schema: "s2_t263_dice_edge_post_deploy_receipt_v1",
  route: "dice-synthetic",
  deployment_alias: "lumis-ai-chat-stg",
  model: "gpt-5-mini",
  model_version: "2025-08-07",
  deployment_type: "GlobalStandard",
  model_version_upgrade_policy: "NoAutoUpgrade",
  guardrail: "Microsoft.DefaultV2",
  tokens_per_minute: 10_000,
  requests_per_minute: 10,
  approved_hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com",
  api_route_family: "v1",
  azure_api_version: null,
  route_family_evidence_sha256: "7c9b3e2878513071d59e2357c3ad3dbcaeab44f08f48537a2cbc6cb6753d16d5",
  official_reference_sha256: "350a5d8e9bdb7a74093189dd97319c5c951a4a7eb4b1f40ad0953da3a3823944",
  pricing_verified: true,
  pricing_evidence_sha256: "2c22ddc1fe40689e99c7a74aed4653e64c39a5ed3ba317a259b5637a8bb41772",
  observed_at: options.observedAt,
  disabled_code: options.disabledCode,
  provider_calls: 0,
  units_consumed: 0,
  normal_persistence_writes: 0,
  evidence_class: "metadata_only",
  retention_days: 30,
  authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"],
})}\n`);

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (!name?.startsWith("--") || value === undefined || values.has(name)) stop("STOP_S2_T263_RECEIPT_ARGUMENTS_INVALID");
    values.set(name, value);
  }
  const providerCalls = Number(values.get("--provider-calls"));
  return {
    disabledCode: values.get("--disabled-code"),
    providerCalls,
    observedAt: values.get("--observed-at") ?? new Date().toISOString(),
  };
}

function stop(code) {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}
