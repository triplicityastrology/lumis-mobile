import {
  CHAT_CANONICAL_T240_SCHEMA_SHA256,
  CHAT_SYNTHETIC_GATEWAY_PORT_VERSION,
  ChatSyntheticGatewayPortV1
} from "./chat-synthetic-gateway-port-v1.ts";
import { CHAT_SYNTHETIC_CAPS } from "./chat-synthetic-gateway-v1.ts";

export const ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE = "ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE" as const;
export const CHAT_SYNTHETIC_INTEGRATED_AUTHORIZATION_VERSION = "s2_t265_chat_authorization_v1" as const;
export const CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256 = "e5a29800e9a1be702612a664b60e4a8e0804f81e59cf72c40433141617373f7f" as const;
export const CHAT_SYNTHETIC_SANITIZED_PRICING_EVIDENCE_SHA256 = "8d8a3d9b155d950ea76f23808f4eec6b507de8a02203d233522c3583f22e799b" as const;
export const CHAT_SYNTHETIC_API_ROUTE_FAMILY = "v1" as const;
export const CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256 = "2dec65e48845fe4fd2ecedd4d83ce10857b2a773a25855d0bea7454bedb4490e" as const;
export const CHAT_SYNTHETIC_OFFICIAL_MICROSOFT_V1_REFERENCE_EVIDENCE_SHA256 = "5086b0c4bb0fc7cd02d82c94c594897b71d191e72bf23108dfa26cf32d48bab5" as const;
export const CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES = Object.freeze({
  deployment_alias: "lumis-ai-chat-stg" as const,
  model: "gpt-5-mini" as const,
  model_version: "2025-08-07" as const,
  deployment_type: "GlobalStandard" as const,
  model_version_upgrade_policy: "NoAutoUpgrade" as const,
  guardrail: "Microsoft.DefaultV2" as const,
  tokens_per_minute_limit: 10_000 as const,
  requests_per_minute_limit: 10 as const,
  foundry_service_hostname: "lumis-foundry-stg-sea-20260731.services.ai.azure.com" as const
});

type IntegratedAuthorization = Readonly<{
  schema: typeof CHAT_SYNTHETIC_INTEGRATED_AUTHORIZATION_VERSION;
  authority: "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED";
  prerequisite_authority: typeof ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE;
  base_commit: "aff17b9698f37d6e251dce3b1aeda73005e91faa";
  candidate_sha256: string;
  microsoft_manifest_sha256: string;
  microsoft_readonly_evidence_sha256: typeof CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256;
  api_route_evidence_sha256: typeof CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256;
  azure_api_version_evidence_sha256: string;
  accepted_dice_evidence_sha256: string;
  gateway_source_sha256: string;
  fixture_registry_sha256: string;
  canonical_t240_schema_sha256: typeof CHAT_CANONICAL_T240_SCHEMA_SHA256;
  gateway_interface: typeof CHAT_SYNTHETIC_GATEWAY_PORT_VERSION;
  run_id: string;
  caps: Readonly<{
    logical: 60;
    en: 30;
    zh_hant: 30;
    attempts: 120;
    input_tokens: 1200;
    output_tokens: 300;
    concurrency: 1;
    deadline_ms: 12000;
    retries: 1;
  }>;
  issued_at: string;
  valid_until: string;
}>;

export type IntegratedAuthorizationControl = Readonly<{
  executionAuthority: boolean;
  candidateSha256: string;
  microsoftManifestSha256: string;
  microsoftReadonlyEvidenceSha256: typeof CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256;
  apiRouteEvidenceSha256: typeof CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256;
  azureApiVersionEvidenceSha256: string | null;
  acceptedDiceEvidenceSha256: string | null;
  acceptedAuthorizationSha256: string | null;
  gatewaySourceSha256: string;
  fixtureRegistrySha256: string;
}>;

const SHA256 = /^[a-f0-9]{64}$/;
const RUN_ID = /^chat-syn-[a-z0-9]{12,32}$/;
const AUTHORIZATION_KEYS = [
  "schema", "authority", "prerequisite_authority", "base_commit", "candidate_sha256",
  "microsoft_manifest_sha256", "microsoft_readonly_evidence_sha256", "api_route_evidence_sha256", "azure_api_version_evidence_sha256",
  "accepted_dice_evidence_sha256", "gateway_source_sha256",
  "fixture_registry_sha256", "canonical_t240_schema_sha256", "gateway_interface", "run_id",
  "caps", "issued_at", "valid_until"
] as const;
const CAP_KEYS = ["logical", "en", "zh_hant", "attempts", "input_tokens", "output_tokens", "concurrency", "deadline_ms", "retries"] as const;
const DEPLOYMENT_KEYS = ["deployment_alias", "model", "model_version", "deployment_type", "model_version_upgrade_policy", "guardrail", "tokens_per_minute_limit", "requests_per_minute_limit", "foundry_service_hostname"] as const;
const DICE_COST_BASIS_KEYS = ["maximum_provider_attempts", "maximum_input_tokens_per_attempt", "maximum_output_tokens_per_attempt", "full_maximum_estimate_usd"] as const;

export class ChatSyntheticIntegratedAuthorizationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ChatSyntheticIntegratedAuthorizationError";
  }
}

export class ChatSyntheticIntegratedCandidateV1 {
  readonly #portFactory: () => ChatSyntheticGatewayPortV1;
  readonly #control: IntegratedAuthorizationControl;
  readonly #nowMs: () => number;
  #port: ChatSyntheticGatewayPortV1 | null = null;

  constructor(portFactory: () => ChatSyntheticGatewayPortV1, control: IntegratedAuthorizationControl, nowMs: () => number = Date.now) {
    this.#portFactory = portFactory;
    this.#control = control;
    this.#nowMs = nowMs;
  }

  async authorize(input: Readonly<{
    diceEvidence: unknown;
    diceEvidenceSha256: string;
    authorization: unknown;
    authorizationSha256: string;
    microsoftManifest: unknown;
    microsoftReadonlyEvidenceText: string;
    apiRouteEvidenceText: string;
    azureApiVersionEvidenceText?: string;
    portAuthority: unknown;
    portAuthoritySha256: string;
  }>): Promise<void> {
    const evidenceDigest = await canonicalSha256(input.diceEvidence);
    const authorizationDigest = await canonicalSha256(input.authorization);
    const microsoftManifestDigest = await canonicalSha256(input.microsoftManifest);
    const microsoftReadonlyEvidenceDigest = await textSha256(input.microsoftReadonlyEvidenceText);
    const apiRouteEvidenceDigest = await textSha256(input.apiRouteEvidenceText);
    const portAuthorityDigest = await canonicalSha256(input.portAuthority);
    if (
      evidenceDigest !== input.diceEvidenceSha256 || authorizationDigest !== input.authorizationSha256 ||
      microsoftManifestDigest !== (input.authorization as { microsoft_manifest_sha256?: unknown })?.microsoft_manifest_sha256 ||
      microsoftManifestDigest !== this.#control.microsoftManifestSha256 ||
      microsoftReadonlyEvidenceDigest !== CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256 ||
      microsoftReadonlyEvidenceDigest !== this.#control.microsoftReadonlyEvidenceSha256 ||
      microsoftReadonlyEvidenceDigest !== (input.authorization as { microsoft_readonly_evidence_sha256?: unknown })?.microsoft_readonly_evidence_sha256 ||
      apiRouteEvidenceDigest !== CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256 ||
      apiRouteEvidenceDigest !== this.#control.apiRouteEvidenceSha256 ||
      apiRouteEvidenceDigest !== (input.authorization as { api_route_evidence_sha256?: unknown })?.api_route_evidence_sha256 ||
      portAuthorityDigest !== input.portAuthoritySha256
    ) {
      fail("CHAT_SYNTHETIC_CHECKSUM_MISMATCH");
    }
    validateMicrosoftDeploymentManifest(input.microsoftManifest);
    validateMicrosoftReadonlyEvidence(input.microsoftReadonlyEvidenceText);
    validateApiRouteEvidence(input.apiRouteEvidenceText);
    if (this.#control.azureApiVersionEvidenceSha256 === null) {
      fail("CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_REQUIRED");
    }
    const authorization = validateAuthorization(
      input.authorization,
      input.authorizationSha256,
      input.diceEvidenceSha256,
      this.#control,
      this.#nowMs()
    );
    const apiEvidenceDigest = await textSha256(input.azureApiVersionEvidenceText ?? "");
    if (
      apiEvidenceDigest !== this.#control.azureApiVersionEvidenceSha256 ||
      apiEvidenceDigest !== authorization.azure_api_version_evidence_sha256
    ) fail("CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_INVALID");
    const portAuthority = input.portAuthority as Record<string, unknown>;
    if (
      authorization.run_id !== portAuthority?.run_id ||
      authorization.candidate_sha256 !== portAuthority?.review_package_sha256 ||
      authorization.accepted_dice_evidence_sha256 !== portAuthority?.dice_evidence_sha256 ||
      authorization.gateway_source_sha256 !== portAuthority?.gateway_source_sha256 ||
      authorization.fixture_registry_sha256 !== portAuthority?.fixture_registry_sha256 ||
      authorization.canonical_t240_schema_sha256 !== portAuthority?.canonical_t240_schema_sha256
    ) {
      fail("CHAT_SYNTHETIC_AUTHORITY_BINDING_INVALID");
    }
    const port = this.#portFactory();
    await port.authorize({
      diceEvidence: input.diceEvidence,
      diceEvidenceSha256: input.diceEvidenceSha256,
      authority: input.portAuthority,
      authoritySha256: input.portAuthoritySha256
    });
    this.#port = port;
  }

  invokeFixture(raw: unknown) {
    if (!this.#port) fail("CHAT_SYNTHETIC_AUTHORITY_REQUIRED");
    return this.#port.invokeFixture(raw);
  }

  disable(runId: string) {
    if (!this.#port) fail("CHAT_SYNTHETIC_AUTHORITY_REQUIRED");
    return this.#port.disable(runId);
  }
}

export async function canonicalSha256(value: unknown): Promise<string> {
  return textSha256(canonicalJson(value));
}

export async function textSha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) fail("CHAT_SYNTHETIC_CANONICAL_VALUE_INVALID");
  return encoded;
}

export function validateMicrosoftDeploymentManifest(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("CHAT_SYNTHETIC_MICROSOFT_MANIFEST_INVALID");
  const manifest = value as Record<string, unknown>;
  if (
    manifest.schema !== "s2_t265_microsoft_chat_manifest_v3" ||
    manifest.authority !== "MICROSOFT_CHAT_DEPLOYMENT_NAMES_APPROVED" ||
    manifest.readonly_evidence_sha256 !== CHAT_SYNTHETIC_MICROSOFT_READONLY_EVIDENCE_SHA256 ||
    manifest.sanitized_pricing_evidence_sha256 !== CHAT_SYNTHETIC_SANITIZED_PRICING_EVIDENCE_SHA256 ||
    manifest.api_route_family_evidence_sha256 !== CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_SHA256 ||
    manifest.official_microsoft_v1_reference_evidence_sha256 !== CHAT_SYNTHETIC_OFFICIAL_MICROSOFT_V1_REFERENCE_EVIDENCE_SHA256 ||
    manifest.transport_policy !== "HTTPS_ONLY_EXACT_HOSTNAME" ||
    manifest.api_route_family !== CHAT_SYNTHETIC_API_ROUTE_FAMILY || manifest.preview_route_allowed !== false ||
    manifest.legacy_date_formatted_api_version_allowed !== false || manifest.model_version_inference_allowed !== false ||
    manifest.azure_api_version !== null || manifest.azure_api_version_verification !== "unverified" ||
    manifest.organization_specific_pricing !== null || manifest.organization_specific_pricing_verification !== "unverified" ||
    manifest.sanitized_pricing_gives_deployment_or_traffic_authority !== false
    || manifest.route_family_evidence_gives_deployment_or_traffic_authority !== false
  ) fail("CHAT_SYNTHETIC_MICROSOFT_MANIFEST_INVALID");
  exactRecord(manifest.verified_deployment_names, DEPLOYMENT_KEYS, "CHAT_SYNTHETIC_MICROSOFT_MANIFEST_INVALID");
  exactRecord(manifest.dice_window_cost_basis, DICE_COST_BASIS_KEYS, "CHAT_SYNTHETIC_MICROSOFT_MANIFEST_INVALID");
  const names = manifest.verified_deployment_names as Record<string, unknown>;
  const cost = manifest.dice_window_cost_basis as Record<string, unknown>;
  const expected = CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES;
  if (
    names.deployment_alias !== expected.deployment_alias || names.model !== expected.model ||
    names.model_version !== expected.model_version || names.deployment_type !== expected.deployment_type ||
    names.model_version_upgrade_policy !== expected.model_version_upgrade_policy || names.guardrail !== expected.guardrail ||
    names.tokens_per_minute_limit !== expected.tokens_per_minute_limit ||
    names.requests_per_minute_limit !== expected.requests_per_minute_limit ||
    names.foundry_service_hostname !== expected.foundry_service_hostname ||
    cost.maximum_provider_attempts !== 240 || cost.maximum_input_tokens_per_attempt !== 800 ||
    cost.maximum_output_tokens_per_attempt !== 300 || cost.full_maximum_estimate_usd !== 0.192 ||
    hasForbiddenManifestField(manifest)
  ) fail("CHAT_SYNTHETIC_MICROSOFT_MANIFEST_INVALID");
}

export function validateMicrosoftReadonlyEvidence(text: string): void {
  let evidence: Record<string, unknown>;
  try {
    evidence = JSON.parse(text) as Record<string, unknown>;
  } catch {
    fail("CHAT_SYNTHETIC_MICROSOFT_EVIDENCE_INVALID");
  }
  const verified = evidence.verified as Record<string, unknown> | undefined;
  const unverified = evidence.not_verified_or_not_collected as Record<string, unknown> | undefined;
  const authority = evidence.authority_status as Record<string, unknown> | undefined;
  const expected = CHAT_SYNTHETIC_MICROSOFT_DEPLOYMENT_NAMES;
  if (
    evidence.evidence_type !== "lumis_azure_foundry_deployment_readonly_v1" || evidence.observed_at !== "2026-08-11" ||
    evidence.environment !== "staging" || evidence.evidence_sha256 !== null || !verified || !unverified || !authority ||
    verified.deployment_alias !== expected.deployment_alias || verified.model !== expected.model ||
    verified.model_version !== expected.model_version || verified.deployment_type !== expected.deployment_type ||
    verified.model_version_upgrade_policy !== expected.model_version_upgrade_policy || verified.guardrail !== expected.guardrail ||
    verified.tokens_per_minute_limit !== expected.tokens_per_minute_limit ||
    verified.requests_per_minute_limit !== expected.requests_per_minute_limit ||
    verified.foundry_service_hostname !== expected.foundry_service_hostname ||
    unverified.azure_api_version !== null || unverified.organization_specific_usd_input_token_price !== null ||
    unverified.organization_specific_usd_output_token_price !== null ||
    authority.normal_chat !== "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY" || authority.azure_traffic !== "NO_AZURE_TRAFFIC_AUTHORITY"
  ) fail("CHAT_SYNTHETIC_MICROSOFT_EVIDENCE_INVALID");
}

export function validateApiRouteEvidence(text: string): void {
  let evidence: Record<string, unknown>;
  try {
    evidence = JSON.parse(text) as Record<string, unknown>;
  } catch {
    fail("CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_INVALID");
  }
  if (
    Object.keys(evidence).sort().join(",") !== "api_route_family,evidence_method,explicitly_excluded,observed_at" ||
    evidence.api_route_family !== CHAT_SYNTHETIC_API_ROUTE_FAMILY ||
    evidence.evidence_method !== "Microsoft Foundry deployment Details page showed the Azure OpenAI-compatible v1 route family" ||
    evidence.observed_at !== "2026-08-11 10:51:58 HKT (+0800)" ||
    !Array.isArray(evidence.explicitly_excluded) ||
    evidence.explicitly_excluded.join(",") !== "endpoint_url_or_path,key,subscription,tenant,email,account_identifier"
  ) fail("CHAT_SYNTHETIC_API_ROUTE_EVIDENCE_INVALID");
}

export function validateAzureApiVersionForV1(value: unknown): void {
  if (value !== null) fail("CHAT_SYNTHETIC_AZURE_API_VERSION_EVIDENCE_REQUIRED");
}

function validateAuthorization(
  value: unknown,
  checksum: string,
  evidenceChecksum: string,
  control: IntegratedAuthorizationControl,
  nowMs: number
): IntegratedAuthorization {
  exactRecord(value, AUTHORIZATION_KEYS, "CHAT_SYNTHETIC_AUTHORIZATION_INVALID");
  const authorization = value as IntegratedAuthorization;
  exactRecord(authorization.caps, CAP_KEYS, "CHAT_SYNTHETIC_AUTHORIZATION_INVALID");
  const issuedAt = Date.parse(authorization.issued_at);
  const validUntil = Date.parse(authorization.valid_until);
  const caps = authorization.caps;
  if (
    control.executionAuthority !== true || !SHA256.test(checksum) || control.acceptedAuthorizationSha256 !== checksum ||
    authorization.schema !== CHAT_SYNTHETIC_INTEGRATED_AUTHORIZATION_VERSION ||
    authorization.authority !== "CHAT_SYNTHETIC_SINGLE_USE_AUTHORIZED" ||
    authorization.prerequisite_authority !== ACCEPTED_DICE_TECHNICAL_WINDOW_EVIDENCE ||
    authorization.base_commit !== "aff17b9698f37d6e251dce3b1aeda73005e91faa" ||
    authorization.candidate_sha256 !== control.candidateSha256 ||
    authorization.microsoft_manifest_sha256 !== control.microsoftManifestSha256 ||
    authorization.microsoft_readonly_evidence_sha256 !== control.microsoftReadonlyEvidenceSha256 ||
    authorization.api_route_evidence_sha256 !== control.apiRouteEvidenceSha256 ||
    authorization.azure_api_version_evidence_sha256 !== control.azureApiVersionEvidenceSha256 ||
    authorization.accepted_dice_evidence_sha256 !== evidenceChecksum ||
    control.acceptedDiceEvidenceSha256 !== evidenceChecksum ||
    authorization.gateway_source_sha256 !== control.gatewaySourceSha256 ||
    authorization.fixture_registry_sha256 !== control.fixtureRegistrySha256 ||
    authorization.canonical_t240_schema_sha256 !== CHAT_CANONICAL_T240_SCHEMA_SHA256 ||
    authorization.gateway_interface !== CHAT_SYNTHETIC_GATEWAY_PORT_VERSION || !RUN_ID.test(authorization.run_id) ||
    !Number.isFinite(issuedAt) || !Number.isFinite(validUntil) || issuedAt > nowMs || validUntil <= nowMs ||
    caps.logical !== CHAT_SYNTHETIC_CAPS.logicalRequests || caps.en !== CHAT_SYNTHETIC_CAPS.enRequests ||
    caps.zh_hant !== CHAT_SYNTHETIC_CAPS.zhHantRequests || caps.attempts !== CHAT_SYNTHETIC_CAPS.providerAttempts ||
    caps.input_tokens !== CHAT_SYNTHETIC_CAPS.inputTokens || caps.output_tokens !== CHAT_SYNTHETIC_CAPS.outputTokens ||
    caps.concurrency !== CHAT_SYNTHETIC_CAPS.concurrency || caps.deadline_ms !== CHAT_SYNTHETIC_CAPS.deadlineMs ||
    caps.retries !== CHAT_SYNTHETIC_CAPS.retries
  ) fail("CHAT_SYNTHETIC_AUTHORIZATION_INVALID");
  return Object.freeze({ ...authorization, caps: Object.freeze({ ...caps }) });
}

function exactRecord(value: unknown, keys: readonly string[], code: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const actual = Object.keys(value as Record<string, unknown>);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(code);
}

function hasForbiddenManifestField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenManifestField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /endpoint|path|api.?key|email|masked|screenshot/iu.test(key) || hasForbiddenManifestField(child)
  );
}

function fail(code: string): never {
  throw new ChatSyntheticIntegratedAuthorizationError(code);
}
