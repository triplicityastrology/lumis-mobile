import {
  ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256,
  DICE_REGISTRY_CHECKSUM,
  RESERVED_DICE_FOUNDER_IDS,
  type ReviewLanguage,
} from "./founderAiReviewContract";

export const T257_DICE_GATEWAY_INTERFACE = "dice_synthetic_gateway_port_v1" as const;
export const FOUNDER_DICE_ACCEPTANCE_SCHEMA = "s2_t264_founder_dice_acceptance_envelope_v1" as const;

// A reviewed source change must replace this null only after Technical has
// independently accepted the exact Founder envelope checksum.
export const ACCEPTED_FOUNDER_DICE_ENVELOPE_SHA256: string | null = null;

export type FounderDiceClassification = "judgment" | "descriptive_reflection";

export type FounderDiceAcceptanceEnvelope = Readonly<{
  schema_version: typeof FOUNDER_DICE_ACCEPTANCE_SCHEMA;
  interface_version: typeof T257_DICE_GATEWAY_INTERFACE;
  fixture_id: string;
  language: ReviewLanguage;
  validation_status: "accepted";
  classification: FounderDiceClassification;
  eligibility: "eligible";
  registry_checksum: typeof DICE_REGISTRY_CHECKSUM;
  technical_evidence_sha256: string;
  effects: Readonly<{ member_auth: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type FounderDiceGatewayStatus = Readonly<{
  interface_version: typeof T257_DICE_GATEWAY_INTERFACE;
  enabled: boolean;
  provider_access: boolean;
  accepted_envelope: boolean;
}>;

export type FounderDiceGatewayResult = Readonly<{
  fixture_id: string;
  evidence: unknown;
}>;

export interface FounderDiceGatewayPort {
  status(): FounderDiceGatewayStatus;
  invoke(request: Readonly<{ fixture_id: string }>): Promise<FounderDiceGatewayResult>;
}

const acceptedEnvelopeObjects = new WeakSet<object>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function parseFounderDiceAcceptanceEnvelope(
  input: unknown,
  independentlyComputedEnvelopeSha256: string,
  acceptedEnvelopeSha256: string | null = ACCEPTED_FOUNDER_DICE_ENVELOPE_SHA256,
  acceptedTechnicalEvidenceSha256: string | null = ACCEPTED_DICE_TECHNICAL_EVIDENCE_SHA256,
): FounderDiceAcceptanceEnvelope {
  if (!isObject(input)) throw new Error("STOP_S2_T264_ENVELOPE_NOT_OBJECT");
  const allowed = [
    "schema_version", "interface_version", "fixture_id", "language", "validation_status",
    "classification", "eligibility", "registry_checksum", "technical_evidence_sha256", "effects",
  ].sort();
  if (Object.keys(input).sort().join(",") !== allowed.join(",")) throw new Error("STOP_S2_T264_ENVELOPE_FIELDS");
  if (!isSha256(independentlyComputedEnvelopeSha256) || acceptedEnvelopeSha256 === null ||
      independentlyComputedEnvelopeSha256 !== acceptedEnvelopeSha256) {
    throw new Error("STOP_S2_T264_ENVELOPE_CHECKSUM_NOT_ACCEPTED");
  }
  if (input.schema_version !== FOUNDER_DICE_ACCEPTANCE_SCHEMA || input.interface_version !== T257_DICE_GATEWAY_INTERFACE ||
      input.validation_status !== "accepted" || input.eligibility !== "eligible" ||
      input.registry_checksum !== DICE_REGISTRY_CHECKSUM || !RESERVED_DICE_FOUNDER_IDS.includes(String(input.fixture_id))) {
    throw new Error("STOP_S2_T264_ENVELOPE_NOT_ELIGIBLE");
  }
  const language: ReviewLanguage = String(input.fixture_id).includes("-ZH-") ? "zh-Hant" : "en";
  if (input.language !== language || !["judgment", "descriptive_reflection"].includes(String(input.classification))) {
    throw new Error("STOP_S2_T264_ENVELOPE_CLASSIFICATION");
  }
  if (!isSha256(input.technical_evidence_sha256) || acceptedTechnicalEvidenceSha256 === null ||
      input.technical_evidence_sha256 !== acceptedTechnicalEvidenceSha256) {
    throw new Error("STOP_S2_T264_TECHNICAL_EVIDENCE_NOT_ACCEPTED");
  }
  if (!isObject(input.effects) || Object.keys(input.effects).sort().join(",") !== "member_auth,persistence_writes,units_charged" ||
      input.effects.member_auth !== 0 || input.effects.persistence_writes !== 0 || input.effects.units_charged !== 0) {
    throw new Error("STOP_S2_T264_ENVELOPE_EFFECTS");
  }
  const envelope: FounderDiceAcceptanceEnvelope = Object.freeze({
    schema_version: FOUNDER_DICE_ACCEPTANCE_SCHEMA,
    interface_version: T257_DICE_GATEWAY_INTERFACE,
    fixture_id: input.fixture_id as string,
    language,
    validation_status: "accepted",
    classification: input.classification as FounderDiceClassification,
    eligibility: "eligible",
    registry_checksum: DICE_REGISTRY_CHECKSUM,
    technical_evidence_sha256: input.technical_evidence_sha256,
    effects: Object.freeze({ member_auth: 0, persistence_writes: 0, units_charged: 0 }),
  });
  acceptedEnvelopeObjects.add(envelope);
  return envelope;
}

export function createFounderDiceInvokeRequest(envelope: FounderDiceAcceptanceEnvelope): Readonly<{ fixture_id: string }> {
  return Object.freeze({ fixture_id: envelope.fixture_id });
}

export function createDisabledFounderDiceGateway(): FounderDiceGatewayPort {
  const status = Object.freeze({
    interface_version: T257_DICE_GATEWAY_INTERFACE,
    enabled: false,
    provider_access: false,
    accepted_envelope: false,
  });
  return Object.freeze({
    status: () => status,
    invoke: async () => { throw new Error("STOP_S2_T264_GATEWAY_DISABLED"); },
  });
}

export async function invokeAcceptedFounderDiceFixture(
  port: FounderDiceGatewayPort,
  envelope: FounderDiceAcceptanceEnvelope,
): Promise<FounderDiceGatewayResult> {
  if (!acceptedEnvelopeObjects.has(envelope)) throw new Error("STOP_S2_T264_ENVELOPE_NOT_ACCEPTED");
  const status = port.status();
  if (status.interface_version !== T257_DICE_GATEWAY_INTERFACE || !status.enabled || !status.provider_access || !status.accepted_envelope) {
    throw new Error("STOP_S2_T264_GATEWAY_DISABLED");
  }
  const request = createFounderDiceInvokeRequest(envelope);
  const result = await port.invoke(request);
  if (!isObject(result) || result.fixture_id !== envelope.fixture_id || Object.keys(result).sort().join(",") !== "evidence,fixture_id") {
    throw new Error("STOP_S2_T264_GATEWAY_RESULT_MISMATCH");
  }
  return result as FounderDiceGatewayResult;
}

export type FounderDiceJourneyState = Readonly<{
  frozen: boolean;
  external_validation: "not_received" | "accepted";
  eligibility: "not_eligible" | "eligible";
  gateway: "disabled" | "ready";
  presentation: "not_yet_run" | "offline_preview" | "live_synthetic";
}>;

export function resolveFounderDiceJourneyState(input: Readonly<{
  frozen: boolean;
  offlinePreview: boolean;
  acceptedEnvelope: FounderDiceAcceptanceEnvelope | null;
  gatewayStatus: FounderDiceGatewayStatus;
}>): FounderDiceJourneyState {
  const accepted = input.acceptedEnvelope !== null;
  const ready = accepted && input.gatewayStatus.enabled && input.gatewayStatus.provider_access && input.gatewayStatus.accepted_envelope;
  return Object.freeze({
    frozen: input.frozen,
    external_validation: accepted ? "accepted" : "not_received",
    eligibility: accepted ? "eligible" : "not_eligible",
    gateway: ready ? "ready" : "disabled",
    presentation: ready ? "live_synthetic" : input.offlinePreview ? "offline_preview" : "not_yet_run",
  });
}
