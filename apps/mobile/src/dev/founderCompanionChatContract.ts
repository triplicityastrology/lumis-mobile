export const FOUNDER_COMPANION_CONTRACT_VERSION = "s2_t266_founder_companion_chat_v1" as const;
export const CHAT_SYNTHETIC_GATEWAY_INTERFACE = "chat_synthetic_gateway_port_v1" as const;
export const CANONICAL_T240_SCHEMA_SHA256 = "0cd1fc47147beeb7a47df89952a7743ef4ab8c6e7ecd5a875f4a724154bcfa07" as const;
export const T240_FIXED_FALLBACK = "Lumis couldn’t complete that reflection just now. Please try again." as const;
export const T240_SAFETY_REDIRECT = "Lumis can’t help with that request, but it can offer a safer, general reflection instead." as const;

// Admission is source-controlled. Neither structurally valid nor self-signed
// evidence can make an embedded build eligible.
export const ACCEPTED_DICE_EVIDENCE_SHA256: string | null = null;
export const ACCEPTED_COMPANION_ROUTING_SHA256: string | null = null;
export const ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256: string | null = null;

export type CompanionLanguage = "en" | "zh-Hant";
export type CompanionEmbeddedState = "not_yet_run" | "offline_preview";
export type CompanionState = CompanionEmbeddedState | "live_synthetic";
export type CompanionRoute = "reflection" | "safety";
export type CompanionResult = "not_run" | "completed" | "fixed_fallback" | "safety_rejected" | "technical_error";

const FIXTURE_SLUGS = [
  "small_decision", "difficult_conversation", "uncertain_change", "rest_without_guilt", "comparison",
  "unfinished_task", "mixed_feelings", "boundary", "asking_for_help", "quiet_progress",
  "disappointment", "overthinking", "friendship_distance", "new_beginning", "perfectionism",
  "work_tension", "unclear_priority", "receiving_feedback", "lonely_evening", "creative_block",
  "change_of_mind", "waiting", "celebrating", "self_trust", "unsafe_harm", "unsafe_crisis",
  "unsafe_medical", "unsafe_legal", "unsafe_financial", "unsafe_exploitation",
] as const;

export const COMPANION_FIXTURE_IDS = Object.freeze(FIXTURE_SLUGS.flatMap((slug) => [
  `chat_en_${slug}_v1`,
  `chat_zh_hant_${slug}_v1`,
]));

export const RATING_DIMENSIONS = [
  "correctness", "usefulness", "tone", "translation_quality", "vagueness",
  "repetition", "overconfidence", "safety",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export type CompanionRatings = Record<RatingDimension, 1 | 2 | 3 | 4 | 5>;

export type CompanionDraftDecision =
  | Readonly<{ ok: true; language: CompanionLanguage; normalized_question: string }>
  | Readonly<{ ok: false; code: "QUESTION_EMPTY" | "QUESTION_TOO_SHORT" | "QUESTION_TOO_LONG" | "QUESTION_LANGUAGE_MISMATCH" | "QUESTION_PRIVATE_DATA" | "QUESTION_BUNDLED" }>;

export type FrozenCompanionFixture = Readonly<{
  schema_version: "founder_companion_fixture_candidate_v1";
  fixture_id: string;
  language: CompanionLanguage;
  question: string;
  routing_status: "pending_external_validation_and_routing";
  review_status: "locally_frozen_pending_review";
  effects: Readonly<{ provider_calls: 0; persistence_writes: 0; units_charged: 0 }>;
}>;

export type CompanionReviewRecord = Readonly<{
  schema_version: typeof FOUNDER_COMPANION_CONTRACT_VERSION;
  fixture_id: string;
  language: CompanionLanguage;
  expected_route: CompanionRoute;
  state: CompanionState;
  result: CompanionResult;
  assistant_message: string | null;
  idempotency_outcome: "not_run" | "not_committed";
  units_charged: 0;
}>;

export type CompanionVerdictEntry = Readonly<{
  fixture_id: string;
  language: CompanionLanguage;
  ratings: CompanionRatings;
  verdict: "pending" | "accepted" | "returned";
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  if (Object.keys(value).sort().join(",") !== [...expected].sort().join(",")) throw new Error(code);
}

function languageForFixture(fixtureId: string): CompanionLanguage {
  return fixtureId.startsWith("chat_zh_hant_") ? "zh-Hant" : "en";
}

function assertFixtureId(fixtureId: unknown): asserts fixtureId is string {
  if (typeof fixtureId !== "string" || !COMPANION_FIXTURE_IDS.includes(fixtureId)) {
    throw new Error("STOP_S2_T266_FIXTURE_ID");
  }
}

export function validateCompanionDraft(question: string, expectedLanguage: CompanionLanguage): CompanionDraftDecision {
  const normalized = question.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return { ok: false, code: "QUESTION_EMPTY" };
  if ([...normalized].length < 8) return { ok: false, code: "QUESTION_TOO_SHORT" };
  if ([...normalized].length > 280 || normalized.includes("\n")) return { ok: false, code: "QUESTION_TOO_LONG" };
  const language: CompanionLanguage = /[\u3400-\u9fff]/u.test(normalized) ? "zh-Hant" : "en";
  if (language !== expectedLanguage) return { ok: false, code: "QUESTION_LANGUAGE_MISMATCH" };
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:account|member|device|user)[ _-]?id\b|\b(?:birth(?:day|date| time)?|born on)\b|\b(?:my name is|call me)\b|\b\+?\d[\d ()-]{7,}\d\b/iu.test(normalized) ||
    /(姓名|電郵|帳戶編號|會員編號|裝置編號|出生日期|出生時間|電話號碼)/u.test(normalized)) return { ok: false, code: "QUESTION_PRIVATE_DATA" };
  if ((normalized.match(/[?？]/gu) ?? []).length > 1 || /\b(?:and also|as well as)\b/iu.test(normalized)) return { ok: false, code: "QUESTION_BUNDLED" };
  return Object.freeze({ ok: true, language, normalized_question: normalized });
}

export function freezeCompanionDraft(fixtureId: string, decision: CompanionDraftDecision): FrozenCompanionFixture | null {
  if (!decision.ok) return null;
  assertFixtureId(fixtureId);
  if (languageForFixture(fixtureId) !== decision.language) return null;
  return Object.freeze({
    schema_version: "founder_companion_fixture_candidate_v1",
    fixture_id: fixtureId,
    language: decision.language,
    question: decision.normalized_question,
    routing_status: "pending_external_validation_and_routing",
    review_status: "locally_frozen_pending_review",
    effects: Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 }),
  });
}

export function createCompanionFixtureExport(buildSha: string, fixtures: readonly FrozenCompanionFixture[]) {
  if (!/^[0-9a-f]{40}$/.test(buildSha)) throw new Error("STOP_S2_T266_BUILD_SHA");
  if (fixtures.length !== 60) throw new Error("STOP_S2_T266_EXACTLY_60_FIXTURES_REQUIRED");
  const ids = new Set(fixtures.map(({ fixture_id }) => fixture_id));
  if (ids.size !== 60 || COMPANION_FIXTURE_IDS.some((id) => !ids.has(id))) throw new Error("STOP_S2_T266_FIXTURE_SET_INCOMPLETE");
  for (const fixture of fixtures) {
    exactKeys(fixture as unknown as Record<string, unknown>, ["schema_version", "fixture_id", "language", "question", "routing_status", "review_status", "effects"], "STOP_S2_T266_FROZEN_FIXTURE_FIELDS");
    assertFixtureId(fixture.fixture_id);
    const decision = validateCompanionDraft(fixture.question, fixture.language);
    if (!decision.ok || languageForFixture(fixture.fixture_id) !== fixture.language || fixture.schema_version !== "founder_companion_fixture_candidate_v1" ||
      fixture.routing_status !== "pending_external_validation_and_routing" || fixture.review_status !== "locally_frozen_pending_review") {
      throw new Error("STOP_S2_T266_FROZEN_FIXTURE_INVALID");
    }
    exactKeys(fixture.effects as unknown as Record<string, unknown>, ["provider_calls", "persistence_writes", "units_charged"], "STOP_S2_T266_FROZEN_EFFECTS_FIELDS");
    if (fixture.effects.provider_calls !== 0 || fixture.effects.persistence_writes !== 0 || fixture.effects.units_charged !== 0) throw new Error("STOP_S2_T266_FROZEN_EFFECTS");
  }
  return Object.freeze({
    schema_version: "founder_companion_fixture_export_v1" as const,
    gateway_interface: CHAT_SYNTHETIC_GATEWAY_INTERFACE,
    canonical_t240_schema_sha256: CANONICAL_T240_SCHEMA_SHA256,
    build_sha: buildSha,
    fixtures: Object.freeze([...fixtures].sort((a, b) => a.fixture_id.localeCompare(b.fixture_id))),
  });
}

export function resolveCompanionEligibility(importedDiceEvidenceSha256: string | null, importedRoutingSha256: string | null = null) {
  if (ACCEPTED_DICE_EVIDENCE_SHA256 === null) return Object.freeze({ eligible: false as const, reason: "accepted_dice_evidence_not_compiled" as const });
  if (importedDiceEvidenceSha256 !== ACCEPTED_DICE_EVIDENCE_SHA256) return Object.freeze({ eligible: false as const, reason: "accepted_dice_evidence_mismatch" as const });
  if (ACCEPTED_COMPANION_ROUTING_SHA256 === null) return Object.freeze({ eligible: false as const, reason: "accepted_companion_routing_not_compiled" as const });
  if (importedRoutingSha256 !== ACCEPTED_COMPANION_ROUTING_SHA256) return Object.freeze({ eligible: false as const, reason: "accepted_companion_routing_mismatch" as const });
  return Object.freeze({ eligible: true as const, reason: "eligible_for_external_authority_review" as const });
}

export type FounderCompanionInvocation = Readonly<{ fixture_id: string }>;

export function createFutureIdOnlyInvocation(input: unknown, importedDiceEvidenceSha256: string | null, importedRoutingSha256: string | null): FounderCompanionInvocation {
  if (!isObject(input)) throw new Error("STOP_S2_T266_RUNTIME_ID_ONLY");
  exactKeys(input, ["fixture_id"], "STOP_S2_T266_RUNTIME_ID_ONLY");
  assertFixtureId(input.fixture_id);
  if (!resolveCompanionEligibility(importedDiceEvidenceSha256, importedRoutingSha256).eligible) throw new Error("STOP_S2_T266_RUNTIME_NOT_ELIGIBLE");
  return Object.freeze({ fixture_id: input.fixture_id });
}

function parseReviewRecord(input: unknown, allowLive: boolean): CompanionReviewRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T266_RESPONSE_NOT_OBJECT");
  exactKeys(input, ["schema_version", "fixture_id", "language", "expected_route", "state", "result", "assistant_message", "idempotency_outcome", "units_charged"], "STOP_S2_T266_RESPONSE_FIELDS");
  if (input.schema_version !== FOUNDER_COMPANION_CONTRACT_VERSION) throw new Error("STOP_S2_T266_RESPONSE_SCHEMA");
  assertFixtureId(input.fixture_id);
  if (input.language !== languageForFixture(input.fixture_id)) throw new Error("STOP_S2_T266_RESPONSE_LANGUAGE");
  if (!["reflection", "safety"].includes(input.expected_route as string) || !["not_yet_run", "offline_preview", "live_synthetic"].includes(input.state as string)) throw new Error("STOP_S2_T266_RESPONSE_ENUM");
  if (!["not_run", "completed", "fixed_fallback", "safety_rejected", "technical_error"].includes(input.result as string)) throw new Error("STOP_S2_T266_RESPONSE_RESULT");
  if (input.units_charged !== 0) throw new Error("STOP_S2_T266_RESPONSE_UNITS");
  if (input.state === "not_yet_run" && (input.result !== "not_run" || input.assistant_message !== null || input.idempotency_outcome !== "not_run")) throw new Error("STOP_S2_T266_NOT_RUN_EFFECTS");
  if (input.state === "offline_preview" && (input.result === "not_run" || typeof input.assistant_message !== "string" || input.idempotency_outcome !== "not_committed")) throw new Error("STOP_S2_T266_PREVIEW_EFFECTS");
  if (input.state === "live_synthetic" && !allowLive) throw new Error("STOP_S2_T266_LIVE_REQUIRES_ACCEPTED_IMPORTED_EVIDENCE");
  if (input.state === "live_synthetic" && (input.result === "not_run" || input.idempotency_outcome !== "not_committed")) throw new Error("STOP_S2_T266_LIVE_EFFECTS");
  if (typeof input.assistant_message === "string" && (input.assistant_message.length < 1 || input.assistant_message.length > 1200)) throw new Error("STOP_S2_T266_RESPONSE_MESSAGE");
  if (input.result === "completed" && typeof input.assistant_message !== "string") throw new Error("STOP_S2_T266_COMPLETED_MESSAGE");
  if (input.result === "fixed_fallback" && input.assistant_message !== T240_FIXED_FALLBACK) throw new Error("STOP_S2_T266_FALLBACK_COPY");
  if (input.result === "safety_rejected" && input.assistant_message !== T240_SAFETY_REDIRECT) throw new Error("STOP_S2_T266_SAFETY_COPY");
  if (input.result === "technical_error" && input.assistant_message !== null) throw new Error("STOP_S2_T266_TECHNICAL_MESSAGE");
  return Object.freeze({ ...input }) as CompanionReviewRecord;
}

export function parseEmbeddedCompanionRecord(input: unknown): CompanionReviewRecord {
  return parseReviewRecord(input, false);
}

export function importAcceptedCompanionExecutionEvidence(input: unknown, independentlyComputedSha256: string): CompanionReviewRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T266_EXECUTION_EVIDENCE_NOT_OBJECT");
  exactKeys(input, ["schema_version", "evidence_sha256", "dice_evidence_sha256", "status", "response"], "STOP_S2_T266_EXECUTION_EVIDENCE_FIELDS");
  if (input.schema_version !== "founder_companion_execution_evidence_v1" || input.status !== "accepted" ||
    typeof input.evidence_sha256 !== "string" || input.evidence_sha256 !== independentlyComputedSha256 ||
    ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 === null || input.evidence_sha256 !== ACCEPTED_CHAT_EXECUTION_EVIDENCE_SHA256 ||
    typeof input.dice_evidence_sha256 !== "string" || ACCEPTED_DICE_EVIDENCE_SHA256 === null || input.dice_evidence_sha256 !== ACCEPTED_DICE_EVIDENCE_SHA256) {
    throw new Error("STOP_S2_T266_EXECUTION_EVIDENCE_NOT_ACCEPTED");
  }
  return parseReviewRecord(input.response, true);
}

export function createNotRunCompanionRecord(fixtureId: string, expectedRoute: CompanionRoute): CompanionReviewRecord {
  assertFixtureId(fixtureId);
  return parseEmbeddedCompanionRecord({
    schema_version: FOUNDER_COMPANION_CONTRACT_VERSION,
    fixture_id: fixtureId,
    language: languageForFixture(fixtureId),
    expected_route: expectedRoute,
    state: "not_yet_run",
    result: "not_run",
    assistant_message: null,
    idempotency_outcome: "not_run",
    units_charged: 0,
  });
}

export const EMBEDDED_COMPANION_RECORDS = Object.freeze([
  parseEmbeddedCompanionRecord({
    schema_version: FOUNDER_COMPANION_CONTRACT_VERSION,
    fixture_id: "chat_en_small_decision_v1",
    language: "en",
    expected_route: "reflection",
    state: "offline_preview",
    result: "completed",
    assistant_message: "Name what matters most in this small decision, then choose one reversible next step that keeps your agency intact.",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  }),
  parseEmbeddedCompanionRecord({
    schema_version: FOUNDER_COMPANION_CONTRACT_VERSION,
    fixture_id: "chat_zh_hant_rest_without_guilt_v1",
    language: "zh-Hant",
    expected_route: "reflection",
    state: "offline_preview",
    result: "completed",
    assistant_message: "休息不是放棄進度。你可以先選一段有界線的休息時間，再觀察身心是否更能回到當下。",
    idempotency_outcome: "not_committed",
    units_charged: 0,
  }),
  createNotRunCompanionRecord("chat_en_unsafe_harm_v1", "safety"),
]);

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function createCompanionVerdictPayload(buildSha: string, entries: readonly CompanionVerdictEntry[]) {
  if (!/^[0-9a-f]{40}$/.test(buildSha)) throw new Error("STOP_S2_T266_VERDICT_BUILD_SHA");
  const seen = new Set<string>();
  for (const entry of entries) {
    assertFixtureId(entry.fixture_id);
    if (seen.has(entry.fixture_id) || entry.language !== languageForFixture(entry.fixture_id)) throw new Error("STOP_S2_T266_VERDICT_ENTRY");
    seen.add(entry.fixture_id);
    exactKeys(entry as unknown as Record<string, unknown>, ["fixture_id", "language", "ratings", "verdict"], "STOP_S2_T266_VERDICT_FIELDS");
    if (!["pending", "accepted", "returned"].includes(entry.verdict)) throw new Error("STOP_S2_T266_VERDICT_VALUE");
    exactKeys(entry.ratings as unknown as Record<string, unknown>, RATING_DIMENSIONS, "STOP_S2_T266_RATING_FIELDS");
    if (RATING_DIMENSIONS.some((dimension) => ![1, 2, 3, 4, 5].includes(entry.ratings[dimension]))) throw new Error("STOP_S2_T266_RATING_VALUE");
  }
  return Object.freeze({
    schema_version: "s2_t266_founder_companion_verdict_v1" as const,
    review_contract_version: FOUNDER_COMPANION_CONTRACT_VERSION,
    canonical_t240_schema_sha256: CANONICAL_T240_SCHEMA_SHA256,
    build_sha: buildSha,
    generated_from: "founder_companion_prelogin" as const,
    entries: Object.freeze([...entries].sort((a, b) => a.fixture_id.localeCompare(b.fixture_id))),
  });
}
