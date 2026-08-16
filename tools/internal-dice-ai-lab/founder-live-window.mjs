import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";

export const TECHNICAL_EVIDENCE_SHA256 = "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612";
export const TECHNICAL_RUN_ID = "dice-tech80-981f8f6406cc3c86b2c939ce";
export const FOUNDER_WINDOW_SCOPE = "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY";
export const FOUNDER_WINDOW_RECEIPT_SCHEMA = "lumis_dice_founder_web_lab_window_authorization_v1";
export const FOUNDER_WINDOW_REQUEST_FIELDS = Object.freeze(["fixture_id", "planet_id", "sign_id", "house_id"]);
export const FOUNDER_FREE_TEXT_REQUEST_FIELDS = Object.freeze(["question", "planet_id", "sign_id", "house_id"]);
export const FOUNDER_ISSUER_KEY_ID = "founder-ed25519-deployment-approver-v1";
export const FOUNDER_PUBLIC_KEY_SPKI_SHA256 = "ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478";
export const PROVIDER_DISPOSITIONS = Object.freeze(["http_400_text_format_schema", "http_non_2xx", "responses_incomplete_content_filter", "responses_incomplete_max_output", "responses_incomplete_other", "responses_completed_empty_output", "responses_completed_non_text_output", "responses_completed_schema_invalid", "responses_completed_valid"]);

const SHA256 = /^[a-f0-9]{64}$/u;
const WINDOW_ID = /^dice-founder40-[a-z0-9]{16,40}$/u;
const isProviderDisposition = (value) => PROVIDER_DISPOSITIONS.includes(value);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);

export async function loadAcceptedTechnicalEvidence(filePath) {
  const bytes = await readFile(filePath);
  if (sha256(bytes) !== TECHNICAL_EVIDENCE_SHA256) throw new Error("LAB_TECHNICAL_EVIDENCE_SHA256_MISMATCH");
  const evidence = JSON.parse(bytes.toString("utf8"));
  const keys = [
    "schema", "run_id", "scope", "technical_cases", "founder_cases", "language", "attempts", "attempt_cap",
    "concurrency_cap", "eligible_retries", "shared_deadline_ms", "input_token_cap", "output_token_cap", "tokenizer",
    "cost_ceiling_usd", "cost_upper_bound_usd", "guardrail", "prompt_version", "result_schema", "microsoft_contract_commit",
    "microsoft_contract_seal_sha256", "source_provenance_manifest_sha256", "integrated_contract_seal_sha256",
    "authorization_sha256", "ambiguous_redispatches", "finally_disable_executed", "provider_disabled_verified",
    "units_charged", "persistence_writes", "recorded_at", "evidence_sha256",
  ];
  if (!exactKeys(evidence, keys) || evidence.schema !== "s2_t345_technical_80_metadata_receipt_v1" || evidence.run_id !== TECHNICAL_RUN_ID ||
      evidence.scope !== "DICE_TECHNICAL_SYNTHETIC_WINDOW_80_ONLY" || evidence.technical_cases !== 80 || evidence.founder_cases !== 0 ||
      evidence.language?.en !== 40 || evidence.language?.["zh-Hant"] !== 40 || evidence.provider_disabled_verified !== true ||
      evidence.finally_disable_executed !== true || evidence.units_charged !== 0 || evidence.persistence_writes !== 0 ||
      evidence.prompt_version !== "lumis_dice_v0_3_prompt_v2" || evidence.result_schema !== "lumis_dice_v0_3_result_v2" ||
      evidence.microsoft_contract_commit !== "c1ec632fdea1f2677621f8b1bd3a71e72d17f071" ||
      evidence.microsoft_contract_seal_sha256 !== "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c") {
    throw new Error("LAB_TECHNICAL_EVIDENCE_INVALID");
  }
  return Object.freeze(evidence);
}

export async function loadFounderWindowReceipt(filePath, publicKeyPath, { now = Date.now(), registrySha256, packageSha256 } = {}) {
  const bytes = await readFile(filePath);
  const receipt = JSON.parse(bytes.toString("utf8"));
  const keys = [
    "schema", "issuer", "decision", "authorization_scope", "request_sha256", "source_commit", "single_use_window_id", "issued_at", "valid_until",
    "technical_evidence_sha256", "founder_registry_sha256", "lab_package_sha256", "fixture_total", "language_totals",
    "request_fields", "provider_attempt_cap", "concurrency_cap", "shared_deadline_ms", "input_token_cap", "output_token_cap",
    "cost_ceiling_usd", "raw_response_retention", "metadata_export_only", "member_data", "persistence_writes", "units_charged",
    "normal_chat_authorized", "signature_algorithm", "issuer_key_id", "issuer_public_key_spki_sha256", "trust_anchor_owner", "issuer_signature_base64",
  ];
  const issuedAt = Date.parse(receipt.issued_at);
  const validUntil = Date.parse(receipt.valid_until);
  if (!exactKeys(receipt, keys) || receipt.schema !== FOUNDER_WINDOW_RECEIPT_SCHEMA || receipt.issuer !== "Lumis Founder Deployment Approver" ||
      receipt.decision !== "AUTHORIZED" || receipt.authorization_scope !== FOUNDER_WINDOW_SCOPE || !WINDOW_ID.test(receipt.single_use_window_id || "") ||
      receipt.request_sha256 !== process.env.LUMIS_FOUNDER_DICE_WINDOW_REQUEST_SHA256 || !SHA256.test(receipt.request_sha256 || "") || !/^[a-f0-9]{40}$/u.test(receipt.source_commit || "") ||
      !Number.isFinite(issuedAt) || !Number.isFinite(validUntil) || issuedAt > now || validUntil <= now || validUntil > issuedAt + 900_000 ||
      receipt.technical_evidence_sha256 !== TECHNICAL_EVIDENCE_SHA256 || receipt.founder_registry_sha256 !== registrySha256 ||
      receipt.lab_package_sha256 !== packageSha256 || receipt.fixture_total !== 40 || receipt.language_totals?.en !== 20 || receipt.language_totals?.["zh-Hant"] !== 20 ||
      JSON.stringify(receipt.request_fields) !== JSON.stringify(FOUNDER_WINDOW_REQUEST_FIELDS) || receipt.provider_attempt_cap !== 80 ||
      receipt.concurrency_cap !== 1 || receipt.shared_deadline_ms !== 12_000 || receipt.input_token_cap !== 800 || receipt.output_token_cap !== 300 ||
      receipt.cost_ceiling_usd !== 0.064 || receipt.raw_response_retention !== "session_memory_only" || receipt.metadata_export_only !== true ||
      receipt.member_data !== 0 || receipt.persistence_writes !== 0 || receipt.units_charged !== 0 || receipt.normal_chat_authorized !== false ||
      receipt.signature_algorithm !== "Ed25519" || receipt.issuer_key_id !== FOUNDER_ISSUER_KEY_ID ||
      receipt.issuer_public_key_spki_sha256 !== FOUNDER_PUBLIC_KEY_SPKI_SHA256 || receipt.trust_anchor_owner !== "Founder" ||
      typeof receipt.issuer_signature_base64 !== "string" || receipt.issuer_signature_base64.length < 80) {
    throw new Error("LAB_FOUNDER_WINDOW_RECEIPT_INVALID");
  }
  const publicKeyPem = await readFile(publicKeyPath, "utf8");
  const publicKey = createPublicKey(publicKeyPem);
  const spki = publicKey.export({ type: "spki", format: "der" });
  if (sha256(spki) !== FOUNDER_PUBLIC_KEY_SPKI_SHA256) throw new Error("LAB_FOUNDER_TRUST_ANCHOR_MISMATCH");
  const { issuer_signature_base64: signature, ...signedPayload } = receipt;
  if (!verify(null, Buffer.from(canonical(signedPayload), "utf8"), publicKey, Buffer.from(signature, "base64"))) {
    throw new Error("LAB_FOUNDER_WINDOW_SIGNATURE_INVALID");
  }
  return Object.freeze({
    receipt,
    receiptSha256: sha256(bytes),
    receiptEncoded: bytes.toString("base64url"),
  });
}

export function createFounderDiceGatewayClient({ functionUrl, anonKey, receiptEncoded, receiptSha256, fetchImpl = fetch }) {
  const expectedOrigin = "https://bmqhwofmdgebpcihjlnb.supabase.co";
  const parsed = new URL(functionUrl);
  if (parsed.origin !== expectedOrigin || parsed.pathname !== "/functions/v1/dice-synthetic" || parsed.search || parsed.hash || !anonKey?.trim() || !/^[A-Za-z0-9_-]+$/u.test(receiptEncoded || "")) {
    throw new Error("LAB_GATEWAY_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async run(request) {
      if (!exactKeys(request, FOUNDER_WINDOW_REQUEST_FIELDS)) throw new Error("LAB_GATEWAY_REQUEST_INVALID");
      const response = await fetchImpl(parsed.href, {
        method: "POST",
        headers: {
          authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "content-type": "application/json",
          "x-lumis-founder-window-receipt-sha256": receiptSha256,
          "x-lumis-founder-window-authorization": receiptEncoded,
        },
        body: JSON.stringify(request),
        // The provider remains capped by the Edge at 12 seconds. The local
        // transport gets a response-only margin so it can receive the Edge's
        // closed timeout projection instead of winning the abort race.
        signal: AbortSignal.timeout(14_000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const code = payload?.error?.code;
        const redactedFailureCode = payload?.error?.redacted_failure_code;
        const providerDisposition = payload?.protected_metadata?.provider_disposition;
        return Object.freeze({
          kind: code === "DICE_SAFETY_REDIRECT" ? "safety" : "fallback",
          code: typeof code === "string" ? code : "DICE_FOUNDER_GATEWAY_UNAVAILABLE",
          redacted_failure_code: typeof redactedFailureCode === "string"
            ? redactedFailureCode
            : typeof code === "string" && code.startsWith("DICE_")
              ? code
              : "DICE_FAILURE_UNCLASSIFIED",
          provider_disposition: isProviderDisposition(providerDisposition) ? providerDisposition : null,
        });
      }
      if (!exactKeys(payload, ["result", "metadata", "protected_metadata"])) throw new Error("LAB_GATEWAY_RESPONSE_INVALID");
      const providerDisposition = payload?.protected_metadata?.provider_disposition;
      if (!isProviderDisposition(providerDisposition)) throw new Error("LAB_GATEWAY_PROTECTED_METADATA_INVALID");
      return Object.freeze({ kind: "completed", result: payload.result, metadata: payload.metadata, provider_disposition: providerDisposition });
    },
  });
}

export function createFounderDiceFreeTextGatewayClient({ functionUrl, anonKey, accessKey, fetchImpl = fetch }) {
  const expectedOrigin = "https://bmqhwofmdgebpcihjlnb.supabase.co";
  const parsed = new URL(functionUrl);
  if (parsed.origin !== expectedOrigin || parsed.pathname !== "/functions/v1/dice-synthetic" || parsed.search || parsed.hash || !anonKey?.trim() || !accessKey?.trim() || accessKey.length < 32) {
    throw new Error("LAB_FREE_TEXT_GATEWAY_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    async run(request) {
      if (!exactKeys(request, FOUNDER_FREE_TEXT_REQUEST_FIELDS)) throw new Error("LAB_FREE_TEXT_GATEWAY_REQUEST_INVALID");
      const response = await fetchImpl(parsed.href, {
        method: "POST",
        headers: {
          authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "content-type": "application/json",
          "x-lumis-founder-free-text-access": accessKey,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(14_000),
      });
      const payload = await response.json().catch(() => null);
      const classification = payload?.classification;
      if (!response.ok) {
        const code = payload?.error?.code;
        const providerDisposition = payload?.protected_metadata?.provider_disposition;
        return Object.freeze({
          kind: code === "DICE_SAFETY_REDIRECT" ? "safety" : "fallback",
          code: typeof code === "string" ? code : "DICE_FOUNDER_GATEWAY_UNAVAILABLE",
          redacted_failure_code: typeof payload?.error?.redacted_failure_code === "string" ? payload.error.redacted_failure_code : "DICE_FAILURE_UNCLASSIFIED",
          classification,
          metadata: payload?.metadata ?? null,
          provider_disposition: isProviderDisposition(providerDisposition) ? providerDisposition : null,
        });
      }
      if (!exactKeys(payload, ["result", "classification", "metadata", "protected_metadata"])) throw new Error("LAB_FREE_TEXT_GATEWAY_RESPONSE_INVALID");
      const providerDisposition = payload?.protected_metadata?.provider_disposition;
      if (!isProviderDisposition(providerDisposition)) throw new Error("LAB_FREE_TEXT_GATEWAY_PROTECTED_METADATA_INVALID");
      return Object.freeze({ kind: "completed", result: payload.result, classification, metadata: payload.metadata, provider_disposition: providerDisposition });
    },
  });
}

export function redactLiveMetadata(value) {
  const allowed = ["fixture_id", "language", "result_class", "attempt_count", "latency_bucket", "input_token_bucket", "output_token_bucket", "cost_bucket"];
  if (!exactKeys(value, allowed)) return null;
  if (typeof value.fixture_id !== "string" || !["en", "zh-Hant"].includes(value.language) || typeof value.result_class !== "string" ||
      !Number.isInteger(value.attempt_count) || value.attempt_count < 0 || value.attempt_count > 2) return null;
  return Object.freeze({ ...value });
}

export function calculateLabPackageSha256(files) {
  return sha256(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, digest]) => `${name}:${digest}`).join("\n") + "\n");
}
