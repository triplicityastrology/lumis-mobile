import { createHash, createPublicKey, verify } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const PROJECT = "bmqhwofmdgebpcihjlnb";
export const FUNCTION = "dice-synthetic";
export const ISSUER = "Lumis Founder Deployment Approver";
export const OWNER = "Founder";
export const FOUNDER_KEY_ID = "founder-ed25519-deployment-approver-v1";
export const FOUNDER_SPKI_SHA256 = "ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478";
export const T314_COMMIT = "179de7e43fd208858d18398586543028ba9d1b5f";
export const T314_PACKAGE = "8b8a545986c756403338a93b3b832762a0918e061d044e27710d27146fc33a71";
export const MIGRATION_SCOPE = "DICE_AUTHORITY_LEDGER_0039_MIGRATION_ONLY";
export const TRAFFIC_SCOPE = "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY";
export const AUTHORITY = Object.freeze(["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
export const PROOF_SHA = "0e4fcfafddf9f1bf9fb02868d895fa4c4f8164980613908bc97d08cf2ecb9b9e";
export const MIGRATION_SHA = "7269c821d01b9819eb5d413401cd4afdc23340ca0aba953f1c33d9f9f891a610";

const SHA = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const MIGRATION_ID = /^dice-0039-[a-z0-9]{16,48}$/u;
const TRAFFIC_ID = /^dice-tech80-[a-z0-9]{16,48}$/u;
const forbidden = [/https?:\/\//iu, /bearer\s/iu, /api[_-]?key/iu, /password/iu, /private[_-]?key/iu, /raw[_-]?(prompt|response|error)/iu];

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const stop = (code) => { const error = new Error(code); error.code = code; throw error; };
const exact = (value, keys, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) stop(code);
};

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function unsignedPayload(value) {
  const copy = structuredClone(value);
  delete copy.issuer_signature_base64;
  return Buffer.from(canonical(copy));
}

export function loadControl(root = process.cwd()) {
  const control = JSON.parse(readFileSync(`${root}/config/s2-t315-authorization-day-control.json`, "utf8"));
  if (control.schema !== "s2_t315_dice_authorization_day_control_v1" || control.project_ref !== PROJECT || control.function_name !== FUNCTION ||
      control.candidate_interface.candidate_path !== "config/s2-t315-exact-t314-candidate.json" || control.candidate_interface.candidate_commit !== T314_COMMIT ||
      control.candidate_interface.candidate_package_sha256 !== T314_PACKAGE || control.founder_authority.issuer !== ISSUER ||
      control.founder_authority.issuer_key_id !== FOUNDER_KEY_ID || control.founder_authority.issuer_public_key_spki_sha256 !== FOUNDER_SPKI_SHA256 ||
      control.founder_authority.trust_anchor_owner !== OWNER || control.founder_authority.maximum_validity_seconds !== 900 ||
      control.migration.scope !== MIGRATION_SCOPE || control.migration.sha256 !== MIGRATION_SHA || control.migration.proof_receipt_sha256 !== PROOF_SHA ||
      control.traffic.scope !== TRAFFIC_SCOPE || control.traffic.technical_cases !== 80 || control.traffic.language.en !== 40 || control.traffic.language["zh-Hant"] !== 40 ||
      control.traffic.founder_cases !== 0 || control.traffic.attempt_cap !== 160 || control.traffic.concurrency !== 2 || control.traffic.eligible_retries !== 1 ||
      control.traffic.shared_deadline_ms !== 12000 || control.traffic.input_token_cap !== 800 || control.traffic.output_token_cap !== 300 ||
      control.traffic.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || control.traffic.cost_ceiling_usd !== 0.128 ||
      JSON.stringify(control.authority_status) !== JSON.stringify(AUTHORITY)) stop("STOP_S2_T315_CONTROL_DRIFT");
  return Object.freeze(control);
}

export function validateCandidate(candidate, control = loadControl()) {
  exact(candidate, ["schema","candidate_commit","candidate_package_sha256","t307_commit","t307_package_sha256","registry_membership","signer_schema","migration_0039_required","authority_status"], "STOP_S2_T315_CANDIDATE_INVALID");
  if (candidate.schema !== control.candidate_interface.schema || candidate.candidate_commit !== T314_COMMIT || candidate.candidate_package_sha256 !== T314_PACKAGE ||
      candidate.t307_commit !== control.candidate_interface.required_t307_commit || candidate.t307_package_sha256 !== control.candidate_interface.required_t307_package_sha256 ||
      candidate.registry_membership !== control.candidate_interface.required_registry_membership || candidate.signer_schema !== control.candidate_interface.required_signer_schema ||
      candidate.migration_0039_required !== true || JSON.stringify(candidate.authority_status) !== JSON.stringify(AUTHORITY)) stop("STOP_S2_T315_CANDIDATE_INVALID");
  return Object.freeze(structuredClone(candidate));
}

export function loadBuiltInCandidate(root = process.cwd(), control = loadControl(root)) {
  return validateCandidate(JSON.parse(readFileSync(`${root}/${control.candidate_interface.candidate_path}`, "utf8")), control);
}

export function validateProofRecord(root = process.cwd(), control = loadControl(root)) {
  const record = JSON.parse(readFileSync(`${root}/config/evidence/s2-t315-accepted-t283-pg17-proof.json`, "utf8"));
  if (record.schema !== "s2_t315_accepted_t283_pg17_proof_v1" || record.source_commit !== control.migration.proof_commit ||
      record.proof_receipt_schema !== control.migration.proof_receipt_schema || record.proof_receipt_sha256 !== PROOF_SHA || record.migration_sha256 !== MIGRATION_SHA ||
      record.postgres_version !== "17.6" || record.network !== "none" || Object.values(record.assertions).some((value) => value !== true) ||
      record.remote_database_used !== false || record.provider_calls !== 0 || JSON.stringify(record.authority_status) !== JSON.stringify(AUTHORITY)) stop("STOP_S2_T315_PG17_PROOF_INVALID");
  return Object.freeze(record);
}

function validateTime(value, now, code) {
  const issued = Date.parse(value.issued_at);
  const expires = Date.parse(value.expires_at);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now + 30_000 || expires <= now || expires <= issued || expires - issued > 900_000) stop(code);
}

function validateFounderSignature(value, publicKeyPem, code, trustAnchor = { keyId: FOUNDER_KEY_ID, spkiSha256: FOUNDER_SPKI_SHA256 }) {
  if (value.issuer !== ISSUER || value.trust_anchor_owner !== OWNER || value.issuer_key_id !== trustAnchor.keyId || value.issuer_public_key_spki_sha256 !== trustAnchor.spkiSha256 ||
      typeof value.issuer_signature_base64 !== "string" || !/^[A-Za-z0-9+/]{80,100}={0,2}$/u.test(value.issuer_signature_base64)) stop(code);
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { stop(code); }
  if (key.asymmetricKeyType !== "ed25519") stop(code);
  const fingerprint = sha256(key.export({ type: "spki", format: "der" }));
  if (fingerprint !== value.issuer_public_key_spki_sha256 || !verify(null, unsignedPayload(value), key, Buffer.from(value.issuer_signature_base64, "base64"))) stop(code);
}

export function validateMigrationAuthorization(value, candidate, publicKeyPem, now = Date.now(), expectedAction = value?.authorized_action, trustAnchor) {
  const code = "STOP_S2_T315_MIGRATION_AUTHORIZATION_INVALID";
  exact(value, ["schema","issuer","issuer_key_id","issuer_public_key_spki_sha256","trust_anchor_owner","issuer_signature_base64","decision","scope","authorization_id","project_ref","migration_version","migration_sha256","proof_commit","proof_receipt_sha256","candidate_commit","candidate_package_sha256","authorized_action","issued_at","expires_at","function_deployment_authorized","provider_traffic_authorized","normal_chat_integration_authorized"], code);
  if (value.schema !== "lumis_dice_authority_ledger_0039_migration_authorization_v3" || value.decision !== "AUTHORIZED" || value.scope !== MIGRATION_SCOPE ||
      !MIGRATION_ID.test(value.authorization_id) || value.project_ref !== PROJECT || value.migration_version !== "0039" || value.migration_sha256 !== MIGRATION_SHA ||
      value.proof_commit !== "b469cb7e0824bd6b864edc983bcd352b37994894" || value.proof_receipt_sha256 !== PROOF_SHA ||
      value.candidate_commit !== candidate.candidate_commit || value.candidate_package_sha256 !== candidate.candidate_package_sha256 ||
      !["APPLY_0039", "ROLLBACK_0039"].includes(value.authorized_action) || value.authorized_action !== expectedAction ||
      value.function_deployment_authorized !== false || value.provider_traffic_authorized !== false || value.normal_chat_integration_authorized !== false) stop(code);
  validateTime(value, now, code);
  validateFounderSignature(value, publicKeyPem, code, trustAnchor);
  if (forbidden.some((pattern) => pattern.test(JSON.stringify(value)))) stop("STOP_S2_T315_PRIVATE_DATA_REJECTED");
  return Object.freeze({ id: value.authorization_id, digest: sha256(canonical(value)), scope: value.scope });
}

export function validateTrafficAuthorization(value, candidate, publicKeyPem, now = Date.now(), trustAnchor) {
  const code = "STOP_S2_T315_TRAFFIC_AUTHORIZATION_INVALID";
  exact(value, ["schema","issuer","issuer_key_id","issuer_public_key_spki_sha256","trust_anchor_owner","issuer_signature_base64","decision","scope","authorization_id","run_id","project_ref","function_name","candidate_commit","candidate_package_sha256","accepted_post_deploy_receipt_sha256","accepted_migration_0039_receipt_sha256","technical_cases","language","founder_cases","attempt_cap","concurrency","eligible_retries","shared_deadline_ms","input_token_cap","output_token_cap","tokenizer","cost_ceiling_usd","issued_at","expires_at","migration_authorized","function_deployment_authorized","normal_chat_integration_authorized"], code);
  exact(value.language, ["en","zh-Hant"], code);
  if (value.schema !== "lumis_dice_technical_synthetic_window_80_authorization_v2" || value.decision !== "AUTHORIZED" || value.scope !== TRAFFIC_SCOPE ||
      !TRAFFIC_ID.test(value.authorization_id) || !TRAFFIC_ID.test(value.run_id) || value.project_ref !== PROJECT || value.function_name !== FUNCTION ||
      value.candidate_commit !== candidate.candidate_commit || value.candidate_package_sha256 !== candidate.candidate_package_sha256 ||
      !SHA.test(value.accepted_post_deploy_receipt_sha256) || !SHA.test(value.accepted_migration_0039_receipt_sha256) ||
      value.technical_cases !== 80 || value.language.en !== 40 || value.language["zh-Hant"] !== 40 || value.founder_cases !== 0 || value.attempt_cap !== 160 ||
      value.concurrency !== 2 || value.eligible_retries !== 1 || value.shared_deadline_ms !== 12000 || value.input_token_cap !== 800 || value.output_token_cap !== 300 ||
      value.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || value.cost_ceiling_usd !== 0.128 || value.migration_authorized !== false ||
      value.function_deployment_authorized !== false || value.normal_chat_integration_authorized !== false) stop(code);
  validateTime(value, now, code);
  validateFounderSignature(value, publicKeyPem, code, trustAnchor);
  if (forbidden.some((pattern) => pattern.test(JSON.stringify(value)))) stop("STOP_S2_T315_PRIVATE_DATA_REJECTED");
  return Object.freeze({ id: value.authorization_id, runId: value.run_id, digest: sha256(canonical(value)), scope: value.scope });
}

export function claimOnce(root, kind, accepted) {
  const path = `${root}/.lumis-local/s2-t315/claims/${kind}/${accepted.id}.json`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  let descriptor;
  try { descriptor = openSync(path, "wx", 0o600); } catch { stop(`STOP_S2_T315_${kind.toUpperCase()}_AUTHORIZATION_REPLAY`); }
  writeFileSync(descriptor, `${JSON.stringify({ schema: `s2_t315_${kind}_claim_v1`, authorization_sha256: accepted.digest, scope: accepted.scope })}\n`);
  closeSync(descriptor);
  return path;
}

export function validateMigrationPostReceipt(value, candidate) {
  exact(value, ["schema","scope","project_ref","migration_version","migration_sha256","candidate_commit","candidate_package_sha256","action","applied","zero_residue_verified","parity_verified","rpc_rls_verified","cleanup_verified","provider_calls","function_deployments","normal_chat_integrations","recorded_at"], "STOP_S2_T315_MIGRATION_RECEIPT_INVALID");
  if (value.schema !== "s2_t315_migration_0039_post_action_receipt_v1" || value.scope !== MIGRATION_SCOPE || value.project_ref !== PROJECT || value.migration_version !== "0039" ||
      value.migration_sha256 !== MIGRATION_SHA || value.candidate_commit !== candidate.candidate_commit || value.candidate_package_sha256 !== candidate.candidate_package_sha256 ||
      !["APPLY_0039", "ROLLBACK_0039"].includes(value.action) || value.applied !== (value.action === "APPLY_0039") ||
      value.zero_residue_verified !== (value.action === "ROLLBACK_0039") || value.parity_verified !== true || value.rpc_rls_verified !== true || value.cleanup_verified !== true ||
      value.provider_calls !== 0 || value.function_deployments !== 0 || value.normal_chat_integrations !== 0 || !Number.isFinite(Date.parse(value.recorded_at))) stop("STOP_S2_T315_MIGRATION_RECEIPT_INVALID");
  return Object.freeze({ digest: sha256(canonical(value)), value: structuredClone(value) });
}

export function validateDeploymentPostReceipt(value, candidate) {
  exact(value, ["schema","project_ref","function_name","candidate_commit","candidate_package_sha256","deployment_id","disabled_probes","both_switches_false","provider_calls","model_invocations","migration_applied","normal_chat_unchanged","recorded_at"], "STOP_S2_T315_DEPLOYMENT_RECEIPT_INVALID");
  exact(value.disabled_probes, ["unknown_fixture","free_form_body","normal_mobile_body","allow_listed_fixture"], "STOP_S2_T315_DEPLOYMENT_RECEIPT_INVALID");
  if (value.schema !== "s2_t314_post_deploy_disabled_receipt_v1" || value.project_ref !== PROJECT || value.function_name !== FUNCTION ||
      value.candidate_commit !== candidate.candidate_commit || value.candidate_package_sha256 !== candidate.candidate_package_sha256 ||
      !/^dice-deploy-[a-z0-9]{16,40}$/u.test(value.deployment_id) || Object.values(value.disabled_probes).some((item) => item !== "DICE_AI_DISABLED") ||
      value.both_switches_false !== true || value.provider_calls !== 0 || value.model_invocations !== 0 || value.migration_applied !== false ||
      value.normal_chat_unchanged !== true || !Number.isFinite(Date.parse(value.recorded_at))) stop("STOP_S2_T315_DEPLOYMENT_RECEIPT_INVALID");
  return Object.freeze({ digest: sha256(canonical(value)), value: structuredClone(value) });
}

export function validateTrafficPostReceipt(value, candidate) {
  exact(value, ["schema","scope","project_ref","function_name","candidate_commit","candidate_package_sha256","run_id","cases","language","attempts","concurrency_peak","cost_usd","cost_ceiling_usd","provider_disabled_verified","founder_cases","units_charged","persistence_writes","recorded_at"], "STOP_S2_T315_TRAFFIC_RECEIPT_INVALID");
  exact(value.language, ["en","zh-Hant"], "STOP_S2_T315_TRAFFIC_RECEIPT_INVALID");
  if (value.schema !== "s2_t315_technical_80_post_action_receipt_v1" || value.scope !== TRAFFIC_SCOPE || value.project_ref !== PROJECT || value.function_name !== FUNCTION ||
      value.candidate_commit !== candidate.candidate_commit || value.candidate_package_sha256 !== candidate.candidate_package_sha256 || !TRAFFIC_ID.test(value.run_id) ||
      value.cases !== 80 || value.language.en !== 40 || value.language["zh-Hant"] !== 40 || value.attempts > 160 || value.concurrency_peak > 2 ||
      value.cost_usd > 0.128 || value.cost_ceiling_usd !== 0.128 || value.provider_disabled_verified !== true || value.founder_cases !== 0 || value.units_charged !== 0 ||
      value.persistence_writes !== 0 || !Number.isFinite(Date.parse(value.recorded_at))) stop("STOP_S2_T315_TRAFFIC_RECEIPT_INVALID");
  return Object.freeze({ digest: sha256(canonical(value)), value: structuredClone(value) });
}
