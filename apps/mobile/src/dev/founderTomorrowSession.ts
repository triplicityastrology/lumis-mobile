import {
  FOUNDER_ENGLISH_DRAFTS,
  FOUNDER_EXCLUDED_ZH_AUTHORING_ID,
  FOUNDER_ZH_HANT_DRAFTS,
  type FounderDraftLanguage,
} from "./founderDiceQuestionBank";

export const T316_SESSION_SCHEMA = "s2_t316_founder_dice_chat_session_v1" as const;
export const T316_TECHNICAL_EVIDENCE_SCHEMA = "s2_t316_accepted_dice_technical_evidence_v1" as const;
export const T316_CHAT_GATE = "WAITING_FOR_ACCEPTED_DICE_EVIDENCE_AND_CHAT_AUTHORITY" as const;
export const T316_ACCEPTED_TECHNICAL_EVIDENCE_SHA256: string | null = null;
export const T316_ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256: string | null = null;

export type FounderTomorrowFixture = Readonly<{
  authoring_id: string;
  fixture_id: string;
  language: FounderDraftLanguage;
  exact_text: string;
}>;

const selectedZh = FOUNDER_ZH_HANT_DRAFTS.filter(
  (item) => item.authoring_id !== FOUNDER_EXCLUDED_ZH_AUTHORING_ID,
);

export const T316_FOUNDER_FIXTURES: readonly FounderTomorrowFixture[] = Object.freeze([
  ...FOUNDER_ENGLISH_DRAFTS.map((item, index) => Object.freeze({
    ...item,
    fixture_id: `DICE-FOUNDER-EN-${String(index + 1).padStart(2, "0")}`,
  })),
  ...selectedZh.map((item, index) => Object.freeze({
    ...item,
    fixture_id: `DICE-FOUNDER-ZH-${String(index + 1).padStart(2, "0")}`,
  })),
]);

type JsonObject = Record<string, unknown>;

export type AcceptedTechnicalEvidence = Readonly<{
  schema_version: typeof T316_TECHNICAL_EVIDENCE_SCHEMA;
  status: "accepted";
  phase: "technical_80_only";
  logical_total: 80;
  language_totals: Readonly<{ en: 40; "zh-Hant": 40 }>;
  founder_cases: 0;
  partial: false;
  provider_disabled_verified: true;
  technical_evidence_sha256: string;
  post_window_disabled_receipt_sha256: string;
  effects: Readonly<{ member_data: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export function parseAcceptedTechnicalEvidence(
  text: string,
  independentlyComputedSha256: string,
  acceptedSha256: string | null = T316_ACCEPTED_TECHNICAL_EVIDENCE_SHA256,
): AcceptedTechnicalEvidence {
  if (!isSha(independentlyComputedSha256) || acceptedSha256 === null || independentlyComputedSha256 !== acceptedSha256) {
    throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_NOT_ACCEPTED");
  }
  if (text.length < 2 || text.length > 100_000 || /loading|redbox|expo error/iu.test(text)) {
    throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_UNSAFE");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_JSON"); }
  if (!isObject(parsed)) throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_OBJECT");
  exactKeys(parsed, [
    "schema_version", "status", "phase", "logical_total", "language_totals", "founder_cases",
    "partial", "provider_disabled_verified", "technical_evidence_sha256",
    "post_window_disabled_receipt_sha256", "effects",
  ], "STOP_S2_T316_TECHNICAL_EVIDENCE_FIELDS");
  if (!isObject(parsed.language_totals) || !isObject(parsed.effects)) throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_SHAPE");
  exactKeys(parsed.language_totals, ["en", "zh-Hant"], "STOP_S2_T316_TECHNICAL_EVIDENCE_LANGUAGE_FIELDS");
  exactKeys(parsed.effects, ["member_data", "persistence_writes", "units_charged"], "STOP_S2_T316_TECHNICAL_EVIDENCE_EFFECT_FIELDS");
  if (
    parsed.schema_version !== T316_TECHNICAL_EVIDENCE_SCHEMA || parsed.status !== "accepted" ||
    parsed.phase !== "technical_80_only" || parsed.logical_total !== 80 || parsed.founder_cases !== 0 ||
    parsed.partial !== false || parsed.provider_disabled_verified !== true ||
    parsed.language_totals.en !== 40 || parsed.language_totals["zh-Hant"] !== 40 ||
    parsed.effects.member_data !== 0 || parsed.effects.persistence_writes !== 0 || parsed.effects.units_charged !== 0 ||
    !isSha(parsed.technical_evidence_sha256) || !isSha(parsed.post_window_disabled_receipt_sha256)
  ) throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_AUTHORITY");
  return Object.freeze(parsed) as AcceptedTechnicalEvidence;
}

export function resolveTomorrowSessionReadiness(input: Readonly<{
  technicalEvidence: AcceptedTechnicalEvidence | null;
  founderWindowReceiptSha256?: string | null;
  chatDeploymentAccepted?: boolean;
  chatTrafficAccepted?: boolean;
}>) {
  if (!input.technicalEvidence) return Object.freeze({
    dice: "WAITING_FOR_ACCEPTED_TECHNICAL_80_EVIDENCE" as const,
    chat: T316_CHAT_GATE,
    next: "Import independently accepted Technical 80 evidence." as const,
  });
  if (!T316_ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256 || input.founderWindowReceiptSha256 !== T316_ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256) {
    return Object.freeze({ dice: "WAITING_FOR_SEPARATE_FOUNDER_WINDOW_AUTHORITY" as const, chat: T316_CHAT_GATE, next: "Supply the separately accepted Founder-window receipt." as const });
  }
  if (!input.chatDeploymentAccepted || !input.chatTrafficAccepted) {
    return Object.freeze({ dice: "READY_FOR_SEPARATELY_AUTHORIZED_FOUNDER_WINDOW" as const, chat: T316_CHAT_GATE, next: "Keep normal Chat disabled pending separate deployment and traffic authority." as const });
  }
  return Object.freeze({ dice: "READY_FOR_SEPARATELY_AUTHORIZED_FOUNDER_WINDOW" as const, chat: "READY_FOR_SEPARATELY_AUTHORIZED_CHAT_WINDOW" as const, next: "Use fixture IDs only." as const });
}

export function createFounderFixtureInvocation(fixtureId: string, evidence: AcceptedTechnicalEvidence | null) {
  if (!evidence) throw new Error("STOP_S2_T316_TECHNICAL_EVIDENCE_REQUIRED");
  const fixture = T316_FOUNDER_FIXTURES.find((item) => item.fixture_id === fixtureId);
  if (!fixture) throw new Error("STOP_S2_T316_FIXTURE_NOT_ALLOW_LISTED");
  if (!T316_ACCEPTED_FOUNDER_WINDOW_RECEIPT_SHA256) throw new Error("STOP_S2_T316_FOUNDER_WINDOW_AUTHORITY_REQUIRED");
  return Object.freeze({ fixture_id: fixture.fixture_id });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function exactKeys(value: JsonObject, expected: readonly string[], code: string) {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw new Error(code);
}
