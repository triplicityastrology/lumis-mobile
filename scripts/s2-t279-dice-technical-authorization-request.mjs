#!/usr/bin/env node
import { loadAndValidateControl } from "./lib/s2-t279-dice-technical-window.mjs";

const { control } = loadAndValidateControl();
const request = {
  schema: "s2_t279_dice_technical_window_authorization_request_v1",
  requested_scope: "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY",
  runtime_commit: control.runtime_commit,
  runtime_package_sha256: control.runtime_package_sha256,
  gateway_package_sha256: control.gateway_package_sha256,
  registry_sha256: control.registry_sha256,
  ledger_contract_commit: control.ledger_proof.commit,
  ledger_proof_schema_sha256: control.ledger_proof.schema_sha256,
  ledger_proof_receipt_sha256: control.ledger_proof.receipt_sha256,
  technical_cases: 80,
  language: { en: 40, "zh-Hant": 40 },
  founder_cases: 0,
  attempt_cap: 160,
  concurrency: 2,
  eligible_retries: 1,
  shared_deadline_ms: 12000,
  cost_ceiling_usd: 0.128,
  receipt_prerequisites: ["accepted_default_off_deployment_receipt", "accepted_0039_migration_receipt"],
  finally_disable_required: true,
  post_window_disabled_proof_required: true,
  evidence_class: "metadata_only",
  authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]
};
process.stdout.write(`${JSON.stringify(request, null, 2)}\n`);
