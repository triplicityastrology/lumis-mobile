import {
  DICE_REGISTRY_CHECKSUM,
  RESERVED_DICE_FOUNDER_IDS,
  canonicalJson,
  freezeFounderDiceDraft,
  validateFounderDiceDraft,
  type ReviewLanguage,
} from "./founderAiReviewContract";

export const FOUNDER_INTAKE_SCHEMA = "s2_t285_founder_dice_intake_v1" as const;
export const FOUNDER_RATING_SHEET_SCHEMA = "s2_t285_founder_dice_rating_sheet_v1" as const;
export const FOUNDER_RUNTIME_REQUEST_SCHEMA = "s2_t285_founder_dice_runtime_request_v1" as const;
export const FOUNDER_WINDOW_SCOPE = "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY" as const;

export type IntakeState = "validation" | "loading" | "interpretation" | "safety" | "fallback";

export const FOUNDER_INTAKE_STATES: readonly Readonly<{
  id: IntakeState;
  title: string;
  detail: string;
}>[] = Object.freeze([
  { id: "validation", title: "Question validation", detail: "Local text validation and deterministic classification only." },
  { id: "loading", title: "Interpretation loading", detail: "Visual fixture only. No provider request is made." },
  { id: "interpretation", title: "Interpretation review", detail: "Local deterministic preview until accepted execution evidence exists." },
  { id: "safety", title: "Safety redirect", detail: "Unsafe or professional-advice requests stop before runtime." },
  { id: "fallback", title: "Fixed fallback", detail: "Failure fixture with zero units and zero persistence." },
]);

export type FrozenIntakeQuestion = Readonly<{
  fixture_id: string;
  language: ReviewLanguage;
  question: string;
  question_sha256: string;
  expected_route: "judgment" | "descriptive_reflection";
  review_status: "locally_frozen_pending_review";
}>;

export type FounderIntakePackage = Readonly<{
  schema_version: typeof FOUNDER_INTAKE_SCHEMA;
  build_sha: string;
  registry_interface: "dice-synthetic-registry-v0.3.0";
  registry_checksum: typeof DICE_REGISTRY_CHECKSUM;
  fixture_total: 40;
  language_totals: Readonly<{ en: 20; "zh-Hant": 20 }>;
  runtime_request_fields: readonly ["fixture_id"];
  authority_required: Readonly<{
    accepted_technical_80_evidence: true;
    separate_founder_window_receipt: true;
  }>;
  fixtures: readonly FrozenIntakeQuestion[];
  effects: Readonly<{ provider_calls: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type FounderRatingRow = Readonly<{
  fixture_id: string;
  language: ReviewLanguage;
  question_sha256: string;
  correctness: null;
  usefulness: null;
  tone: null;
  astrological_sense: null;
  translation_quality: null;
  vagueness: null;
  repetition: null;
  overconfidence: null;
  safety: null;
  verdict: "pending";
}>;

const SHA256 = /^[0-9a-f]{64}$/;

function isPrivateOrSensitive(question: string): boolean {
  return /(?:https?:\/\/|www\.|@\w+|\b\d{3}[- .]?\d{3}[- .]?\d{4}\b|\b(?:passport|address|postal code|credit card|bank account|social security|identity card|hkid)\b)/iu.test(question) ||
    /(?:網址|住址|地址|郵遞區號|身份證|護照|信用卡|銀行帳戶|社會保障號碼)/u.test(question);
}

export function validateFounderIntakeQuestion(question: string, language: ReviewLanguage) {
  if (isPrivateOrSensitive(question)) return Object.freeze({ ok: false as const, code: "QUESTION_PRIVATE_DATA" as const });
  return validateFounderDiceDraft(question, language);
}

export function createFrozenIntakeQuestion(
  fixtureId: string,
  question: string,
  language: ReviewLanguage,
  questionSha256: string,
): FrozenIntakeQuestion {
  if (!SHA256.test(questionSha256)) throw new Error("STOP_S2_T285_QUESTION_CHECKSUM");
  const decision = validateFounderIntakeQuestion(question, language);
  const frozen = freezeFounderDiceDraft(fixtureId, decision);
  if (!frozen) throw new Error("STOP_S2_T285_QUESTION_NOT_FREEZABLE");
  return Object.freeze({
    fixture_id: frozen.fixture_id,
    language: frozen.language,
    question: frozen.question,
    question_sha256: questionSha256,
    expected_route: frozen.expected_route,
    review_status: frozen.review_status,
  });
}

export function createFounderIntakePackage(buildSha: string, fixtures: readonly FrozenIntakeQuestion[]): FounderIntakePackage {
  if (!/^[0-9a-f]{40}$/.test(buildSha)) throw new Error("STOP_S2_T285_BUILD_SHA");
  if (fixtures.length !== 40) throw new Error("STOP_S2_T285_EXACTLY_40");
  const sorted = [...fixtures].sort((a, b) => a.fixture_id.localeCompare(b.fixture_id));
  if (new Set(sorted.map((item) => item.fixture_id)).size !== 40 || RESERVED_DICE_FOUNDER_IDS.some((id) => !sorted.some((item) => item.fixture_id === id))) {
    throw new Error("STOP_S2_T285_FIXTURE_SET");
  }
  if (sorted.filter((item) => item.language === "en").length !== 20 || sorted.filter((item) => item.language === "zh-Hant").length !== 20) {
    throw new Error("STOP_S2_T285_LANGUAGE_COUNTS");
  }
  const checksums = new Set<string>();
  for (const fixture of sorted) {
    if (!SHA256.test(fixture.question_sha256) || checksums.has(fixture.question_sha256)) throw new Error("STOP_S2_T285_DUPLICATE_OR_INVALID_CHECKSUM");
    checksums.add(fixture.question_sha256);
    const decision = validateFounderIntakeQuestion(fixture.question, fixture.language);
    const refrozen = freezeFounderDiceDraft(fixture.fixture_id, decision);
    if (!refrozen || refrozen.expected_route !== fixture.expected_route) throw new Error("STOP_S2_T285_FIXTURE_DRIFT");
  }
  return Object.freeze({
    schema_version: FOUNDER_INTAKE_SCHEMA,
    build_sha: buildSha,
    registry_interface: "dice-synthetic-registry-v0.3.0",
    registry_checksum: DICE_REGISTRY_CHECKSUM,
    fixture_total: 40,
    language_totals: Object.freeze({ en: 20, "zh-Hant": 20 }),
    runtime_request_fields: Object.freeze(["fixture_id"] as const),
    authority_required: Object.freeze({ accepted_technical_80_evidence: true, separate_founder_window_receipt: true }),
    fixtures: Object.freeze(sorted),
    effects: Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 }),
  });
}

export function createFounderRatingSheet(buildSha: string, intakePackageSha256: string, fixtures: readonly FrozenIntakeQuestion[]) {
  if (!/^[0-9a-f]{40}$/.test(buildSha) || !SHA256.test(intakePackageSha256) || fixtures.length !== 40) throw new Error("STOP_S2_T285_RATING_SHEET_INPUT");
  const rows: FounderRatingRow[] = [...fixtures].sort((a, b) => a.fixture_id.localeCompare(b.fixture_id)).map((fixture) => Object.freeze({
    fixture_id: fixture.fixture_id,
    language: fixture.language,
    question_sha256: fixture.question_sha256,
    correctness: null,
    usefulness: null,
    tone: null,
    astrological_sense: null,
    translation_quality: null,
    vagueness: null,
    repetition: null,
    overconfidence: null,
    safety: null,
    verdict: "pending",
  }));
  return Object.freeze({ schema_version: FOUNDER_RATING_SHEET_SCHEMA, build_sha: buildSha, intake_package_sha256: intakePackageSha256, rows: Object.freeze(rows) });
}

export function createFounderRuntimeRequest(fixtureId: string, acceptedTechnicalEvidence: boolean, acceptedFounderReceipt: boolean) {
  if (!RESERVED_DICE_FOUNDER_IDS.includes(fixtureId)) throw new Error("STOP_S2_T285_RUNTIME_FIXTURE_ID");
  if (!acceptedTechnicalEvidence) throw new Error("STOP_S2_T285_WAITING_FOR_ACCEPTED_80_EVIDENCE");
  if (!acceptedFounderReceipt) throw new Error("STOP_S2_T285_WAITING_FOR_FOUNDER_WINDOW_RECEIPT");
  return Object.freeze({ schema_version: FOUNDER_RUNTIME_REQUEST_SCHEMA, fixture_id: fixtureId });
}

export function intakeCanonicalJson(value: unknown): string {
  return canonicalJson(value);
}
