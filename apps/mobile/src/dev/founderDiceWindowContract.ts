import {
  DICE_REGISTRY_CHECKSUM,
  RESERVED_DICE_FOUNDER_IDS,
  canonicalJson,
  type FrozenFounderQuestion,
  type ReviewLanguage,
  type SyntheticReviewRecord,
} from "./founderAiReviewContract";

export const DICE_GATEWAY_INTERFACE = "dice_synthetic_gateway_port_v1" as const;
export const T272_RUNTIME_COMMIT = "f5f9e9da238633d84eb8695307c573eef8f1bc96" as const;
export const T272_RUNTIME_PROOF_SHA256 = "3f44ef8c674ae70037f1e34ffde9f0efb70862ee1bc4b158cadbeae50efe1256" as const;
export const T274_LEDGER_PROOF_RECEIPT_SHA256 = "4b10620285c08a16688bfa5f8dd85912ce6a4ee6d7cff13c8a17f2ce13da2f9e" as const;
export const RUNTIME_ACCEPTANCE_SCHEMA = "s2_t280_dice_runtime_package_acceptance_v1" as const;
export const TECHNICAL_EVIDENCE_SCHEMA = "s2_t280_dice_technical_evidence_acceptance_v1" as const;
export const FOUNDER_WINDOW_REQUEST_SCHEMA = "s2_t280_founder_window_authorization_request_v1" as const;
export const FOUNDER_WINDOW_RECEIPT_SCHEMA = "s2_t280_founder_window_authorization_receipt_v1" as const;
export const FOUNDER_EXECUTION_SCHEMA = "s2_t280_founder_execution_evidence_v1" as const;
export const POST_WINDOW_SCHEMA = "s2_t280_founder_post_window_disabled_v1" as const;

// These source allow-lists remain empty until independently reviewed receipts
// are accepted. Pasted or locally authored envelopes cannot advance the UI.
export const ACCEPTED_RUNTIME_ENVELOPE_SHA256: string | null = null;
export const ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string | null = null;
export const ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256: string | null = null;
export const ACCEPTED_FOUNDER_EXECUTION_EVIDENCE_SHA256_BY_FIXTURE: Readonly<Record<string, string>> = Object.freeze({});

type JsonObject = Record<string, unknown>;

export type RuntimePackageAcceptance = Readonly<{
  schema_version: typeof RUNTIME_ACCEPTANCE_SCHEMA;
  status: "accepted";
  interface_version: typeof DICE_GATEWAY_INTERFACE;
  runtime_source_commit: typeof T272_RUNTIME_COMMIT;
  runtime_proof_sha256: typeof T272_RUNTIME_PROOF_SHA256;
  final_release_commit: string;
  final_package_sha256: string;
  deployment_receipt_sha256: string;
  function_name: "dice-synthetic";
  deployment_scope: "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY";
  migration_0039_in_scope: false;
  provider_disabled_verified: true;
  provider_calls: 0;
  model_invocations: 0;
}>;

export type TechnicalEvidenceImport = Readonly<{
  schema_version: typeof TECHNICAL_EVIDENCE_SCHEMA;
  status: "accepted";
  phase: "technical_80_only";
  runtime_package_sha256: string;
  runtime_acceptance_sha256: string;
  technical_evidence_package_sha256: string;
  ledger_proof_receipt_sha256: typeof T274_LEDGER_PROOF_RECEIPT_SHA256;
  registry_checksum: typeof DICE_REGISTRY_CHECKSUM;
  logical_total: 80;
  language_totals: Readonly<{ en: 40; "zh-Hant": 40 }>;
  founder_cases: 0;
  partial: false;
  provider_disabled_verified: true;
  post_window_disabled_receipt_sha256: string;
  effects: Readonly<{ member_data: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type FounderWindowAuthorizationRequest = Readonly<{
  schema_version: typeof FOUNDER_WINDOW_REQUEST_SCHEMA;
  interface_version: typeof DICE_GATEWAY_INTERFACE;
  runtime_package_sha256: string;
  runtime_acceptance_sha256: string;
  technical_evidence_sha256: string;
  founder_fixture_package_sha256: string;
  fixture_total: 40;
  language_totals: Readonly<{ en: 20; "zh-Hant": 20 }>;
  invocation_shape: "fixture_id_only";
  requested_scope: "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY";
  requested_status: "founder_window_authorization_requested";
  effects: Readonly<{ member_data: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type FounderWindowAuthorizationReceipt = Readonly<{
  schema_version: typeof FOUNDER_WINDOW_RECEIPT_SCHEMA;
  status: "accepted";
  authorization_scope: "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY";
  request_sha256: string;
  runtime_package_sha256: string;
  technical_evidence_sha256: string;
  fixture_package_sha256: string;
  fixture_total: 40;
  language_totals: Readonly<{ en: 20; "zh-Hant": 20 }>;
  single_use_window_id: string;
  valid_until: string;
  invocation_shape: "fixture_id_only";
}>;

export type FounderExecutionEvidence = Readonly<{
  schema_version: typeof FOUNDER_EXECUTION_SCHEMA;
  runtime_package_sha256: string;
  technical_evidence_sha256: string;
  founder_authorization_receipt_sha256: string;
  fixture_id: string;
  language: ReviewLanguage;
  state: "live_synthetic";
  result_class: Exclude<SyntheticReviewRecord["result_class"], "not_run">;
  safe_rendered_output: string;
  attempt_count: 1 | 2;
  latency_bucket: Exclude<SyntheticReviewRecord["latency_bucket"], "not_run">;
  input_token_bucket: Exclude<SyntheticReviewRecord["input_token_bucket"], "not_run" | "801_to_1200">;
  output_token_bucket: Exclude<SyntheticReviewRecord["output_token_bucket"], "not_run">;
  effects: Readonly<{ persistence_writes: 0; units_charged: 0 }>;
}>;

export type PostWindowProof = Readonly<{
  schema_version: typeof POST_WINDOW_SCHEMA;
  runtime_package_sha256: string;
  founder_authorization_receipt_sha256: string;
  gateway_enabled: false;
  provider_access: false;
  founder_window_closed: true;
  provider_disabled_verified: true;
  provider_calls_after_close: 0;
  evidence_sha256: string;
}>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: JsonObject, expected: readonly string[], code: string): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw new Error(code);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function parseJsonText(text: string, code: string): unknown {
  if (text.length < 2 || text.length > 250_000 || /loading|expo error|redbox/iu.test(text)) throw new Error(code);
  try { return JSON.parse(text); } catch { throw new Error(code); }
}

function requireAcceptedDigest(computed: string, accepted: string | null, code: string): void {
  if (!isSha256(computed) || accepted === null || computed !== accepted) throw new Error(code);
}

export function parseRuntimePackageAcceptance(
  text: string,
  independentlyComputedSha256: string,
  acceptedSha256: string | null = ACCEPTED_RUNTIME_ENVELOPE_SHA256,
): RuntimePackageAcceptance {
  const input = parseJsonText(text, "STOP_S2_T280_RUNTIME_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T280_RUNTIME_OBJECT");
  exactKeys(input, ["schema_version", "status", "interface_version", "runtime_source_commit", "runtime_proof_sha256", "final_release_commit", "final_package_sha256", "deployment_receipt_sha256", "function_name", "deployment_scope", "migration_0039_in_scope", "provider_disabled_verified", "provider_calls", "model_invocations"], "STOP_S2_T280_RUNTIME_FIELDS");
  if (input.schema_version !== RUNTIME_ACCEPTANCE_SCHEMA || input.status !== "accepted" || input.interface_version !== DICE_GATEWAY_INTERFACE ||
      input.runtime_source_commit !== T272_RUNTIME_COMMIT || input.runtime_proof_sha256 !== T272_RUNTIME_PROOF_SHA256 ||
      input.function_name !== "dice-synthetic" || input.deployment_scope !== "DEFAULT_OFF_DICE_SYNTHETIC_FUNCTION_DEPLOYMENT_ONLY" ||
      input.migration_0039_in_scope !== false || input.provider_disabled_verified !== true || input.provider_calls !== 0 || input.model_invocations !== 0 ||
      typeof input.final_release_commit !== "string" || !/^[0-9a-f]{40}$/.test(input.final_release_commit) ||
      !isSha256(input.final_package_sha256) || !isSha256(input.deployment_receipt_sha256)) throw new Error("STOP_S2_T280_RUNTIME_AUTHORITY");
  requireAcceptedDigest(independentlyComputedSha256, acceptedSha256, "STOP_S2_T280_RUNTIME_NOT_ACCEPTED");
  return Object.freeze({ ...input }) as RuntimePackageAcceptance;
}

export function parseTechnicalEvidenceImport(
  text: string,
  independentlyComputedSha256: string,
  runtime: RuntimePackageAcceptance,
  runtimeAcceptanceSha256: string,
  acceptedSha256: string | null = ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
): TechnicalEvidenceImport {
  const input = parseJsonText(text, "STOP_S2_T280_TECHNICAL_EVIDENCE_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T280_TECHNICAL_EVIDENCE_OBJECT");
  exactKeys(input, ["schema_version", "status", "phase", "runtime_package_sha256", "runtime_acceptance_sha256", "technical_evidence_package_sha256", "ledger_proof_receipt_sha256", "registry_checksum", "logical_total", "language_totals", "founder_cases", "partial", "provider_disabled_verified", "post_window_disabled_receipt_sha256", "effects"], "STOP_S2_T280_TECHNICAL_EVIDENCE_FIELDS");
  if (input.schema_version !== TECHNICAL_EVIDENCE_SCHEMA || input.status !== "accepted" || input.phase !== "technical_80_only" ||
      input.runtime_package_sha256 !== runtime.final_package_sha256 || input.runtime_acceptance_sha256 !== runtimeAcceptanceSha256 ||
      input.ledger_proof_receipt_sha256 !== T274_LEDGER_PROOF_RECEIPT_SHA256 || input.registry_checksum !== DICE_REGISTRY_CHECKSUM ||
      input.logical_total !== 80 || input.founder_cases !== 0 || input.partial !== false || input.provider_disabled_verified !== true ||
      !isSha256(input.technical_evidence_package_sha256) || !isSha256(input.post_window_disabled_receipt_sha256) || !isObject(input.language_totals) || !isObject(input.effects)) {
    throw new Error("STOP_S2_T280_TECHNICAL_EVIDENCE_AUTHORITY");
  }
  exactKeys(input.language_totals, ["en", "zh-Hant"], "STOP_S2_T280_TECHNICAL_EVIDENCE_LANGUAGE_FIELDS");
  exactKeys(input.effects, ["member_data", "persistence_writes", "units_charged"], "STOP_S2_T280_TECHNICAL_EVIDENCE_EFFECT_FIELDS");
  if (input.language_totals.en !== 40 || input.language_totals["zh-Hant"] !== 40 || input.effects.member_data !== 0 || input.effects.persistence_writes !== 0 || input.effects.units_charged !== 0) {
    throw new Error("STOP_S2_T280_TECHNICAL_EVIDENCE_COUNTS_OR_EFFECTS");
  }
  requireAcceptedDigest(independentlyComputedSha256, acceptedSha256, "STOP_S2_T280_TECHNICAL_EVIDENCE_NOT_ACCEPTED");
  return Object.freeze({ ...input, language_totals: Object.freeze({ en: 40, "zh-Hant": 40 }), effects: Object.freeze({ member_data: 0, persistence_writes: 0, units_charged: 0 }) }) as TechnicalEvidenceImport;
}

export function createFounderWindowAuthorizationRequest(input: Readonly<{
  runtime: RuntimePackageAcceptance;
  runtimeAcceptanceSha256: string;
  technicalEvidence: TechnicalEvidenceImport;
  technicalEvidenceSha256: string;
  founderFixturePackageSha256: string;
  fixtures: readonly FrozenFounderQuestion[];
}>): FounderWindowAuthorizationRequest {
  for (const sha of [input.runtimeAcceptanceSha256, input.technicalEvidenceSha256, input.founderFixturePackageSha256]) if (!isSha256(sha)) throw new Error("STOP_S2_T280_AUTHORIZATION_CHECKSUM");
  if (input.technicalEvidence.runtime_package_sha256 !== input.runtime.final_package_sha256 || input.technicalEvidence.runtime_acceptance_sha256 !== input.runtimeAcceptanceSha256) throw new Error("STOP_S2_T280_AUTHORIZATION_CHAIN");
  if (input.fixtures.length !== 40 || new Set(input.fixtures.map((item) => item.fixture_id)).size !== 40 || RESERVED_DICE_FOUNDER_IDS.some((id) => !input.fixtures.some((item) => item.fixture_id === id))) throw new Error("STOP_S2_T280_AUTHORIZATION_FIXTURE_SET");
  const en = input.fixtures.filter((item) => item.language === "en").length;
  const zh = input.fixtures.filter((item) => item.language === "zh-Hant").length;
  if (en !== 20 || zh !== 20) throw new Error("STOP_S2_T280_AUTHORIZATION_LANGUAGE_COUNTS");
  return Object.freeze({
    schema_version: FOUNDER_WINDOW_REQUEST_SCHEMA,
    interface_version: DICE_GATEWAY_INTERFACE,
    runtime_package_sha256: input.runtime.final_package_sha256,
    runtime_acceptance_sha256: input.runtimeAcceptanceSha256,
    technical_evidence_sha256: input.technicalEvidenceSha256,
    founder_fixture_package_sha256: input.founderFixturePackageSha256,
    fixture_total: 40,
    language_totals: Object.freeze({ en: 20, "zh-Hant": 20 }),
    invocation_shape: "fixture_id_only",
    requested_scope: "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY",
    requested_status: "founder_window_authorization_requested",
    effects: Object.freeze({ member_data: 0, persistence_writes: 0, units_charged: 0 }),
  });
}

export function parseFounderWindowAuthorizationReceipt(
  text: string,
  independentlyComputedSha256: string,
  requestSha256: string,
  request: FounderWindowAuthorizationRequest,
  acceptedSha256: string | null = ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256,
): FounderWindowAuthorizationReceipt {
  const input = parseJsonText(text, "STOP_S2_T280_FOUNDER_RECEIPT_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T280_FOUNDER_RECEIPT_OBJECT");
  exactKeys(input, ["schema_version", "status", "authorization_scope", "request_sha256", "runtime_package_sha256", "technical_evidence_sha256", "fixture_package_sha256", "fixture_total", "language_totals", "single_use_window_id", "valid_until", "invocation_shape"], "STOP_S2_T280_FOUNDER_RECEIPT_FIELDS");
  if (input.schema_version !== FOUNDER_WINDOW_RECEIPT_SCHEMA || input.status !== "accepted" || input.authorization_scope !== "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY" ||
      input.request_sha256 !== requestSha256 || input.runtime_package_sha256 !== request.runtime_package_sha256 || input.technical_evidence_sha256 !== request.technical_evidence_sha256 ||
      input.fixture_package_sha256 !== request.founder_fixture_package_sha256 || input.fixture_total !== 40 || input.invocation_shape !== "fixture_id_only" ||
      typeof input.single_use_window_id !== "string" || !/^dice-founder40-[a-z0-9]{16,40}$/.test(input.single_use_window_id) ||
      typeof input.valid_until !== "string" || !Number.isFinite(Date.parse(input.valid_until)) || !isObject(input.language_totals)) throw new Error("STOP_S2_T280_FOUNDER_RECEIPT_AUTHORITY");
  exactKeys(input.language_totals, ["en", "zh-Hant"], "STOP_S2_T280_FOUNDER_RECEIPT_LANGUAGE_FIELDS");
  if (input.language_totals.en !== 20 || input.language_totals["zh-Hant"] !== 20) throw new Error("STOP_S2_T280_FOUNDER_RECEIPT_LANGUAGE_COUNTS");
  requireAcceptedDigest(independentlyComputedSha256, acceptedSha256, "STOP_S2_T280_FOUNDER_RECEIPT_NOT_ACCEPTED");
  return Object.freeze({ ...input, language_totals: Object.freeze({ en: 20, "zh-Hant": 20 }) }) as FounderWindowAuthorizationReceipt;
}

export function createFounderInvocation(fixtureId: string, receipt: FounderWindowAuthorizationReceipt): Readonly<{ fixture_id: string }> {
  if (!RESERVED_DICE_FOUNDER_IDS.includes(fixtureId) || receipt.status !== "accepted") throw new Error("STOP_S2_T280_INVOCATION_FIXTURE_ID");
  return Object.freeze({ fixture_id: fixtureId });
}

export function parseFounderExecutionEvidence(
  text: string,
  independentlyComputedSha256: string,
  expectedFixtureId: string,
  runtime: RuntimePackageAcceptance,
  technicalEvidenceSha256: string,
  founderReceiptSha256: string,
  acceptedExecutionEvidenceSha256: string | null = ACCEPTED_FOUNDER_EXECUTION_EVIDENCE_SHA256_BY_FIXTURE[expectedFixtureId] ?? null,
): FounderExecutionEvidence {
  const input = parseJsonText(text, "STOP_S2_T280_EXECUTION_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T280_EXECUTION_OBJECT");
  exactKeys(input, ["schema_version", "runtime_package_sha256", "technical_evidence_sha256", "founder_authorization_receipt_sha256", "fixture_id", "language", "state", "result_class", "safe_rendered_output", "attempt_count", "latency_bucket", "input_token_bucket", "output_token_bucket", "effects"], "STOP_S2_T280_EXECUTION_FIELDS");
  if (input.schema_version !== FOUNDER_EXECUTION_SCHEMA || input.runtime_package_sha256 !== runtime.final_package_sha256 || input.technical_evidence_sha256 !== technicalEvidenceSha256 ||
      input.founder_authorization_receipt_sha256 !== founderReceiptSha256 || input.fixture_id !== expectedFixtureId || input.state !== "live_synthetic" || !RESERVED_DICE_FOUNDER_IDS.includes(String(input.fixture_id))) throw new Error("STOP_S2_T280_EXECUTION_AUTHORITY");
  const expectedLanguage: ReviewLanguage = expectedFixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  if (input.language !== expectedLanguage || !["completed", "safety_redirect", "fixed_fallback", "technical_error"].includes(String(input.result_class)) ||
      typeof input.safe_rendered_output !== "string" || input.safe_rendered_output.length < 1 || input.safe_rendered_output.length > 1200 ||
      ![1, 2].includes(input.attempt_count as number) || !["under_3s", "3_to_8s", "8_to_12s", "timeout"].includes(String(input.latency_bucket)) ||
      !["0_to_400", "401_to_800"].includes(String(input.input_token_bucket)) || !["0_to_150", "151_to_300"].includes(String(input.output_token_bucket)) ||
      !isObject(input.effects) || input.effects.persistence_writes !== 0 || input.effects.units_charged !== 0) throw new Error("STOP_S2_T280_EXECUTION_RESULT");
  exactKeys(input.effects, ["persistence_writes", "units_charged"], "STOP_S2_T280_EXECUTION_EFFECTS");
  requireAcceptedDigest(independentlyComputedSha256, acceptedExecutionEvidenceSha256, "STOP_S2_T280_EXECUTION_NOT_ACCEPTED");
  return Object.freeze({ ...input, language: expectedLanguage, effects: Object.freeze({ persistence_writes: 0, units_charged: 0 }) }) as FounderExecutionEvidence;
}

export function parsePostWindowProof(text: string, runtimePackageSha256: string, founderReceiptSha256: string): PostWindowProof {
  const input = parseJsonText(text, "STOP_S2_T280_POST_WINDOW_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T280_POST_WINDOW_OBJECT");
  exactKeys(input, ["schema_version", "runtime_package_sha256", "founder_authorization_receipt_sha256", "gateway_enabled", "provider_access", "founder_window_closed", "provider_disabled_verified", "provider_calls_after_close", "evidence_sha256"], "STOP_S2_T280_POST_WINDOW_FIELDS");
  if (input.schema_version !== POST_WINDOW_SCHEMA || input.runtime_package_sha256 !== runtimePackageSha256 || input.founder_authorization_receipt_sha256 !== founderReceiptSha256 ||
      input.gateway_enabled !== false || input.provider_access !== false || input.founder_window_closed !== true || input.provider_disabled_verified !== true || input.provider_calls_after_close !== 0 ||
      !isSha256(input.evidence_sha256)) throw new Error("STOP_S2_T280_POST_WINDOW_NOT_DISABLED");
  return Object.freeze({ ...input }) as PostWindowProof;
}

export function authorizationRequestCanonicalJson(request: FounderWindowAuthorizationRequest): string {
  return canonicalJson(request);
}
