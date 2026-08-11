import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { canonicalJson, repositoryIdentity, sha256 } from "./lib/s2-t296-chat-operational.mjs";

const root = process.cwd();
const mode = process.argv[2];
const control = JSON.parse(readFileSync(path.join(root, "config/s2-t296-chat-operational-control.json"), "utf8"));
const seal = JSON.parse(readFileSync(path.join(root, "config/s2-t296-chat-operational-seal.json"), "utf8"));
const identity = repositoryIdentity(root);
const issuedAt = new Date();
const validUntil = new Date(issuedAt.getTime() + 15 * 60 * 1000);
const common = {
  project_ref: control.project_ref,
  review_package_sha256: seal.package_binding_sha256,
  source_commit: identity.head,
  source_tree: identity.tree,
  issued_at: issuedAt.toISOString(),
  valid_until: validUntil.toISOString(),
  nonce: randomBytes(16).toString("hex"),
};

let request;
if (mode === "deployment") {
  request = { schema: "s2_t296_chat_default_off_deployment_request_v1", requested_scope: control.scopes.deployment, function_name: control.function_name, provider_enabled: false, provider_calls_allowed: 0, disabled_probe_count: 4, migration_0040_authorized: false, traffic_authorized: false, normal_chat_connected: false, rollback_revision_required: true, ...common };
} else if (mode === "migration") {
  request = { schema: "s2_t296_chat_migration_0040_request_v1", requested_scope: control.scopes.migration, migration_version: "0040", migration_sha256: control.migration_0040_sha256, function_deployment_authorized: false, traffic_authorized: false, provider_calls_allowed: 0, ...common };
} else if (mode === "traffic") {
  if (control.compiled_authorities.dice_technical_evidence_sha256 === null) {
    console.error("WAITING_FOR_ACCEPTED_T287_T289_DICE_EVIDENCE");
    process.exit(2);
  }
  request = { schema: "s2_t296_chat_synthetic_traffic_request_v1", requested_scope: control.scopes.traffic, function_name: control.function_name, accepted_dice_evidence_sha256: control.compiled_authorities.dice_technical_evidence_sha256, fixture_count: 60, language_counts: { en: 30, zh_hant: 30 }, attempt_cap: 120, input_token_cap: 1200, output_token_cap: 300, concurrency: 1, eligible_retries: 1, shared_deadline_ms: 12000, runtime_request_fields: ["fixture_id"], normal_chat_connected: false, member_context: false, threads: false, messages: false, persistence_writes: 0, units_charged: 0, ...common };
} else {
  throw new Error("STOP_S2_T296_REQUEST_SCOPE");
}
const payload = { ...request, request_sha256: sha256(canonicalJson(request)) };
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
