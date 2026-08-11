import {
  DICE_REGISTRY_CHECKSUM,
  RESERVED_DICE_FOUNDER_IDS,
  canonicalJson,
  type FrozenFounderQuestion,
  type ReviewLanguage,
  type SyntheticReviewRecord,
} from "./founderAiReviewContract";

export const T262_PACKAGE_SHA256 = "adbc3b887f85f8d2b615aa1fd6f4ffec7bafeff3204a4f1e309b1102b8b04f71" as const;
export const T262_GATEWAY_INTERFACE = "dice_synthetic_gateway_port_v1" as const;
export const TECHNICAL_EVIDENCE_SCHEMA = "s2_t269_dice_technical_evidence_import_v1" as const;
export const FOUNDER_WINDOW_REQUEST_SCHEMA = "s2_t269_founder_window_authorization_request_v1" as const;
export const FOUNDER_EXECUTION_SCHEMA = "s2_t269_founder_execution_evidence_v1" as const;
export const POST_WINDOW_SCHEMA = "s2_t269_founder_post_window_disabled_v1" as const;

// Acceptance remains a reviewed source decision. A pasted or self-authored
// envelope can never advance the live Founder path in this build.
export const ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string | null = null;
export const ACCEPTED_FOUNDER_WINDOW_AUTHORIZATION_SHA256: string | null = null;
export const ACCEPTED_FOUNDER_EXECUTION_EVIDENCE_SHA256_BY_FIXTURE: Readonly<Record<string, string>> = Object.freeze({});

type JsonObject = Record<string, unknown>;

export type TechnicalEvidenceImport = Readonly<{
  schema_version: typeof TECHNICAL_EVIDENCE_SCHEMA;
  package_sha256: typeof T262_PACKAGE_SHA256;
  gateway_interface: typeof T262_GATEWAY_INTERFACE;
  registry_checksum: typeof DICE_REGISTRY_CHECKSUM;
  phase: "technical";
  status: "accepted";
  logical_total: 80;
  language_totals: Readonly<{ en: 40; "zh-Hant": 40 }>;
  partial: false;
  provider_disabled_verified: true;
  records_sha256: string;
  run_receipt_sha256: string;
}>;

export type FounderWindowAuthorizationRequest = Readonly<{
  schema_version: typeof FOUNDER_WINDOW_REQUEST_SCHEMA;
  package_sha256: typeof T262_PACKAGE_SHA256;
  gateway_interface: typeof T262_GATEWAY_INTERFACE;
  technical_evidence_sha256: string;
  founder_fixture_package_sha256: string;
  fixture_total: 40;
  language_totals: Readonly<{ en: 20; "zh-Hant": 20 }>;
  invocation_shape: "fixture_id_only";
  requested_status: "founder_window_authorization_requested";
  effects: Readonly<{ member_data: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type FounderExecutionEvidence = Readonly<{
  schema_version: typeof FOUNDER_EXECUTION_SCHEMA;
  package_sha256: typeof T262_PACKAGE_SHA256;
  authorization_sha256: string;
  fixture_id: string;
  language: ReviewLanguage;
  state: "live_synthetic";
  result_class: Exclude<SyntheticReviewRecord["result_class"], "not_run">;
  safe_rendered_output: string;
  attempt_count: 1 | 2;
  latency_bucket: Exclude<SyntheticReviewRecord["latency_bucket"], "not_run">;
  input_token_bucket: Exclude<SyntheticReviewRecord["input_token_bucket"], "not_run" | "801_to_1200">;
  output_token_bucket: Exclude<SyntheticReviewRecord["output_token_bucket"], "not_run">;
  provider_disabled_after_window: boolean;
  effects: Readonly<{ persistence_writes: 0; units_charged: 0 }>;
}>;

export type PostWindowProof = Readonly<{
  schema_version: typeof POST_WINDOW_SCHEMA;
  package_sha256: typeof T262_PACKAGE_SHA256;
  authorization_sha256: string;
  gateway_enabled: false;
  provider_access: false;
  founder_window_closed: true;
  provider_disabled_verified: true;
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

export function parseTechnicalEvidenceImport(
  text: string,
  independentlyComputedSha256: string,
  acceptedSha256: string | null = ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
): TechnicalEvidenceImport {
  const input = parseJsonText(text, "STOP_S2_T269_TECHNICAL_EVIDENCE_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T269_TECHNICAL_EVIDENCE_OBJECT");
  exactKeys(input, ["schema_version", "package_sha256", "gateway_interface", "registry_checksum", "phase", "status", "logical_total", "language_totals", "partial", "provider_disabled_verified", "records_sha256", "run_receipt_sha256"], "STOP_S2_T269_TECHNICAL_EVIDENCE_FIELDS");
  if (input.schema_version !== TECHNICAL_EVIDENCE_SCHEMA || input.package_sha256 !== T262_PACKAGE_SHA256 ||
      input.gateway_interface !== T262_GATEWAY_INTERFACE || input.registry_checksum !== DICE_REGISTRY_CHECKSUM ||
      input.phase !== "technical" || input.status !== "accepted") throw new Error("STOP_S2_T269_TECHNICAL_EVIDENCE_AUTHORITY");
  if (input.logical_total !== 80 || input.partial !== false || input.provider_disabled_verified !== true || !isObject(input.language_totals)) {
    throw new Error("STOP_S2_T269_TECHNICAL_EVIDENCE_PARTIAL");
  }
  exactKeys(input.language_totals, ["en", "zh-Hant"], "STOP_S2_T269_TECHNICAL_EVIDENCE_LANGUAGE_FIELDS");
  if (input.language_totals.en !== 40 || input.language_totals["zh-Hant"] !== 40) throw new Error("STOP_S2_T269_TECHNICAL_EVIDENCE_LANGUAGE_COUNTS");
  if (!isSha256(input.records_sha256) || !isSha256(input.run_receipt_sha256) || !isSha256(independentlyComputedSha256) ||
      acceptedSha256 === null || independentlyComputedSha256 !== acceptedSha256) throw new Error("STOP_S2_T269_TECHNICAL_EVIDENCE_NOT_ACCEPTED");
  return Object.freeze({ ...input, language_totals: Object.freeze({ en: 40, "zh-Hant": 40 }) }) as TechnicalEvidenceImport;
}

export function createFounderWindowAuthorizationRequest(input: Readonly<{
  technicalEvidence: TechnicalEvidenceImport;
  technicalEvidenceSha256: string;
  founderFixturePackageSha256: string;
  fixtures: readonly FrozenFounderQuestion[];
}>): FounderWindowAuthorizationRequest {
  if (!isSha256(input.technicalEvidenceSha256) || !isSha256(input.founderFixturePackageSha256)) throw new Error("STOP_S2_T269_AUTHORIZATION_CHECKSUM");
  if (input.fixtures.length !== 40 || new Set(input.fixtures.map((item) => item.fixture_id)).size !== 40 ||
      RESERVED_DICE_FOUNDER_IDS.some((id) => !input.fixtures.some((item) => item.fixture_id === id))) throw new Error("STOP_S2_T269_AUTHORIZATION_FIXTURE_SET");
  const en = input.fixtures.filter((item) => item.language === "en").length;
  const zh = input.fixtures.filter((item) => item.language === "zh-Hant").length;
  if (en !== 20 || zh !== 20) throw new Error("STOP_S2_T269_AUTHORIZATION_LANGUAGE_COUNTS");
  return Object.freeze({
    schema_version: FOUNDER_WINDOW_REQUEST_SCHEMA,
    package_sha256: T262_PACKAGE_SHA256,
    gateway_interface: T262_GATEWAY_INTERFACE,
    technical_evidence_sha256: input.technicalEvidenceSha256,
    founder_fixture_package_sha256: input.founderFixturePackageSha256,
    fixture_total: 40,
    language_totals: Object.freeze({ en: 20, "zh-Hant": 20 }),
    invocation_shape: "fixture_id_only",
    requested_status: "founder_window_authorization_requested",
    effects: Object.freeze({ member_data: 0, persistence_writes: 0, units_charged: 0 }),
  });
}

export function createFounderInvocation(fixtureId: string): Readonly<{ fixture_id: string }> {
  if (!RESERVED_DICE_FOUNDER_IDS.includes(fixtureId)) throw new Error("STOP_S2_T269_INVOCATION_FIXTURE_ID");
  return Object.freeze({ fixture_id: fixtureId });
}

export function parseFounderExecutionEvidence(
  text: string,
  independentlyComputedSha256: string,
  expectedFixtureId: string,
  acceptedAuthorizationSha256: string | null = ACCEPTED_FOUNDER_WINDOW_AUTHORIZATION_SHA256,
  acceptedExecutionEvidenceSha256: string | null = ACCEPTED_FOUNDER_EXECUTION_EVIDENCE_SHA256_BY_FIXTURE[expectedFixtureId] ?? null,
): FounderExecutionEvidence {
  const input = parseJsonText(text, "STOP_S2_T269_EXECUTION_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T269_EXECUTION_OBJECT");
  exactKeys(input, ["schema_version", "package_sha256", "authorization_sha256", "fixture_id", "language", "state", "result_class", "safe_rendered_output", "attempt_count", "latency_bucket", "input_token_bucket", "output_token_bucket", "provider_disabled_after_window", "effects"], "STOP_S2_T269_EXECUTION_FIELDS");
  if (input.schema_version !== FOUNDER_EXECUTION_SCHEMA || input.package_sha256 !== T262_PACKAGE_SHA256 || input.fixture_id !== expectedFixtureId ||
      input.state !== "live_synthetic" || !RESERVED_DICE_FOUNDER_IDS.includes(String(input.fixture_id))) throw new Error("STOP_S2_T269_EXECUTION_AUTHORITY");
  const expectedLanguage: ReviewLanguage = expectedFixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  if (input.language !== expectedLanguage || !["completed", "safety_redirect", "fixed_fallback", "technical_error"].includes(String(input.result_class)) ||
      typeof input.safe_rendered_output !== "string" || input.safe_rendered_output.length < 1 || input.safe_rendered_output.length > 1200 ||
      ![1, 2].includes(input.attempt_count as number) || !["under_3s", "3_to_8s", "8_to_12s", "timeout"].includes(String(input.latency_bucket)) ||
      !["0_to_400", "401_to_800"].includes(String(input.input_token_bucket)) || !["0_to_150", "151_to_300"].includes(String(input.output_token_bucket)) ||
      !isObject(input.effects) || input.effects.persistence_writes !== 0 || input.effects.units_charged !== 0) throw new Error("STOP_S2_T269_EXECUTION_RESULT");
  exactKeys(input.effects, ["persistence_writes", "units_charged"], "STOP_S2_T269_EXECUTION_EFFECTS");
  if (!isSha256(input.authorization_sha256) || !isSha256(independentlyComputedSha256) || acceptedAuthorizationSha256 === null ||
      input.authorization_sha256 !== acceptedAuthorizationSha256 || acceptedExecutionEvidenceSha256 === null ||
      independentlyComputedSha256 !== acceptedExecutionEvidenceSha256) throw new Error("STOP_S2_T269_EXECUTION_NOT_AUTHORIZED");
  return Object.freeze({ ...input, language: expectedLanguage, effects: Object.freeze({ persistence_writes: 0, units_charged: 0 }) }) as FounderExecutionEvidence;
}

export function parsePostWindowProof(text: string, expectedAuthorizationSha256: string): PostWindowProof {
  const input = parseJsonText(text, "STOP_S2_T269_POST_WINDOW_JSON");
  if (!isObject(input)) throw new Error("STOP_S2_T269_POST_WINDOW_OBJECT");
  exactKeys(input, ["schema_version", "package_sha256", "authorization_sha256", "gateway_enabled", "provider_access", "founder_window_closed", "provider_disabled_verified", "evidence_sha256"], "STOP_S2_T269_POST_WINDOW_FIELDS");
  if (input.schema_version !== POST_WINDOW_SCHEMA || input.package_sha256 !== T262_PACKAGE_SHA256 || input.authorization_sha256 !== expectedAuthorizationSha256 ||
      input.gateway_enabled !== false || input.provider_access !== false || input.founder_window_closed !== true || input.provider_disabled_verified !== true ||
      !isSha256(input.evidence_sha256)) throw new Error("STOP_S2_T269_POST_WINDOW_NOT_DISABLED");
  return Object.freeze({ ...input }) as PostWindowProof;
}

export function authorizationRequestCanonicalJson(request: FounderWindowAuthorizationRequest): string {
  return canonicalJson(request);
}
