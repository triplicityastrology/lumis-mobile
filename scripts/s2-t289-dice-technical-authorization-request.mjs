import { randomBytes } from "node:crypto";
import { loadAndValidateControl, sha256 } from "./lib/s2-t289-dice-technical-window.mjs";

const { control } = loadAndValidateControl();
const issuedAt = new Date();
const request = {
  schema: "s2_t289_dice_technical_synthetic_window_80_authorization_request_v1",
  requested_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  request_id: `dice-tech80-request-${randomBytes(10).toString("hex")}`,
  project_ref: control.project_ref,
  function_name: control.function_name,
  deployment_receipt_required: control.deployment.post_deploy_receipt_schema,
  deployment_authorization_schema: control.deployment.schema,
  runtime_package_sha256: control.deployment.runtime_package_sha256,
  migration_receipt_required: "s2_t289_accepted_t283_migration_0039_receipt_v1",
  migration_authorization_scope: control.migration.authorization_scope,
  migration_proof_receipt_sha256: control.migration.proof_receipt_sha256,
  registry_sha256: control.registry.payload_sha256,
  technical_cases: 80,
  language: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  attempt_cap: 160,
  concurrency: 2,
  eligible_retries: 1,
  shared_deadline_ms: 12000,
  input_token_cap: 800,
  output_token_cap: 300,
  tokenizer: "js-tiktoken@1.0.21/o200k_base",
  cost_ceiling_usd: 0.128,
  issued_at: issuedAt.toISOString(),
  requested_valid_until: new Date(issuedAt.getTime() + 15 * 60_000).toISOString(),
  provider_calls_before_authorization: 0,
  grants_authority: false,
};
const requestSha256 = sha256(`${JSON.stringify(request)}\n`);
process.stdout.write(`${JSON.stringify({ ...request, request_sha256: requestSha256 }, null, 2)}\n`);
