export const FOUNDER_AI_REVIEW_SCHEMA_VERSION = "s2_t256_founder_ai_review_v1" as const;

export type ReviewSection = "dice" | "companion_chat";
export type ReviewLanguage = "en" | "zh-Hant";
export type ReviewState = "not_yet_run" | "offline_preview" | "live_synthetic" | "blocked" | "fallback";
export type ExpectedClass = "judgment" | "descriptive" | "safety" | "fallback" | "technical_error";

export const RATING_DIMENSIONS = [
  "correctness",
  "usefulness",
  "tone",
  "astrological_sense",
  "translation_quality",
  "vagueness",
  "repetition",
  "overconfidence",
  "safety",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];
export type ReviewRatings = Record<RatingDimension, 1 | 2 | 3 | 4 | 5>;

export type SyntheticReviewRecord = {
  schema_version: typeof FOUNDER_AI_REVIEW_SCHEMA_VERSION;
  fixture_id: string;
  section: ReviewSection;
  language: ReviewLanguage;
  expected_class: ExpectedClass;
  state: ReviewState;
  rendered_output: string | null;
  latency_bucket: "not_run" | "under_3s" | "3_to_8s" | "8_to_12s" | "timeout";
  input_token_bucket: "not_run" | "0_to_400" | "401_to_800" | "801_to_1200";
  output_token_bucket: "not_run" | "0_to_150" | "151_to_300";
  attempt_count: 0 | 1 | 2;
  result_class: "not_run" | "completed" | "safety_redirect" | "fixed_fallback" | "technical_error";
  retry_class: "none" | "eligible_once" | "retried_once" | "not_eligible";
};

const ALLOWED_KEYS = [
  "schema_version", "fixture_id", "section", "language", "expected_class", "state",
  "rendered_output", "latency_bucket", "input_token_bucket", "output_token_bucket",
  "attempt_count", "result_class", "retry_class",
] as const;

const values = {
  section: ["dice", "companion_chat"],
  language: ["en", "zh-Hant"],
  expected_class: ["judgment", "descriptive", "safety", "fallback", "technical_error"],
  state: ["not_yet_run", "offline_preview", "live_synthetic", "blocked", "fallback"],
  latency_bucket: ["not_run", "under_3s", "3_to_8s", "8_to_12s", "timeout"],
  input_token_bucket: ["not_run", "0_to_400", "401_to_800", "801_to_1200"],
  output_token_bucket: ["not_run", "0_to_150", "151_to_300"],
  attempt_count: [0, 1, 2],
  result_class: ["not_run", "completed", "safety_redirect", "fixed_fallback", "technical_error"],
  retry_class: ["none", "eligible_once", "retried_once", "not_eligible"],
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowed<K extends keyof typeof values>(key: K, value: unknown): boolean {
  return (values[key] as readonly unknown[]).includes(value);
}

export function parseSyntheticReviewRecord(input: unknown): SyntheticReviewRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T251_REVIEW_RECORD_NOT_OBJECT");
  const keys = Object.keys(input).sort();
  const expectedKeys = [...ALLOWED_KEYS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("STOP_S2_T251_REVIEW_RECORD_FIELDS");
  }
  if (input.schema_version !== FOUNDER_AI_REVIEW_SCHEMA_VERSION) throw new Error("STOP_S2_T251_SCHEMA_VERSION");
  if (typeof input.fixture_id !== "string" || !/^(DICE-FOUNDER-(EN|ZH)-\d{2}|chat_(en|zh_hant)_[a-z0-9_]+)$/.test(input.fixture_id)) {
    throw new Error("STOP_S2_T251_FIXTURE_ID");
  }
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (!isAllowed(key, input[key])) throw new Error(`STOP_S2_T251_${key.toUpperCase()}`);
  }
  if (input.rendered_output !== null && (typeof input.rendered_output !== "string" || input.rendered_output.length < 1 || input.rendered_output.length > 1200)) {
    throw new Error("STOP_S2_T251_RENDERED_OUTPUT");
  }
  if ((input.fixture_id.startsWith("DICE-") && input.section !== "dice") || (input.fixture_id.startsWith("chat_") && input.section !== "companion_chat")) {
    throw new Error("STOP_S2_T251_FIXTURE_SECTION");
  }
  if (((input.fixture_id.includes("-EN-") || input.fixture_id.startsWith("chat_en_")) && input.language !== "en") ||
    ((input.fixture_id.includes("-ZH-") || input.fixture_id.startsWith("chat_zh_hant_")) && input.language !== "zh-Hant")) {
    throw new Error("STOP_S2_T251_FIXTURE_LANGUAGE");
  }
  if (input.state === "not_yet_run" && (input.rendered_output !== null || input.result_class !== "not_run" || input.attempt_count !== 0)) {
    throw new Error("STOP_S2_T251_NOT_RUN_EFFECTS");
  }
  if (input.state === "blocked" && input.result_class !== "safety_redirect") throw new Error("STOP_S2_T251_BLOCKED_RESULT");
  if (input.state === "fallback" && input.result_class !== "fixed_fallback") throw new Error("STOP_S2_T251_FALLBACK_RESULT");
  return input as SyntheticReviewRecord;
}

export const RESERVED_DICE_FOUNDER_IDS = [
  ...Array.from({ length: 20 }, (_, index) => `DICE-FOUNDER-EN-${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 20 }, (_, index) => `DICE-FOUNDER-ZH-${String(index + 1).padStart(2, "0")}`),
] as readonly string[];

export const LATER_CHAT_FIXTURE_IDS = ["chat_en_reflection_01", "chat_en_safety_01", "chat_zh_hant_reflection_01", "chat_zh_hant_safety_01"] as const;

export function createNotRunRecord(fixtureId: string, section: ReviewSection, expectedClass: ExpectedClass): SyntheticReviewRecord {
  const language: ReviewLanguage = fixtureId.includes("-ZH-") || fixtureId.startsWith("chat_zh_hant_") ? "zh-Hant" : "en";
  return parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION,
    fixture_id: fixtureId,
    section,
    language,
    expected_class: expectedClass,
    state: "not_yet_run",
    rendered_output: null,
    latency_bucket: "not_run",
    input_token_bucket: "not_run",
    output_token_bucket: "not_run",
    attempt_count: 0,
    result_class: "not_run",
    retry_class: "none",
  });
}

export const REVIEW_FIXTURES: readonly SyntheticReviewRecord[] = [
  parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, fixture_id: "DICE-FOUNDER-EN-01", section: "dice", language: "en",
    expected_class: "judgment", state: "offline_preview", rendered_output: "The symbols invite a deliberate yes: move when the next practical step is clear, rather than forcing certainty.",
    latency_bucket: "not_run", input_token_bucket: "not_run", output_token_bucket: "not_run", attempt_count: 0,
    result_class: "completed", retry_class: "none",
  }),
  parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, fixture_id: "DICE-FOUNDER-ZH-01", section: "dice", language: "zh-Hant",
    expected_class: "descriptive", state: "live_synthetic", rendered_output: "這組象徵提醒你先觀察互動中的節奏，再決定哪一步最值得投入。這是合成測試結果，不是會員資料。",
    latency_bucket: "3_to_8s", input_token_bucket: "0_to_400", output_token_bucket: "0_to_150", attempt_count: 1,
    result_class: "completed", retry_class: "none",
  }),
  parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, fixture_id: "DICE-FOUNDER-EN-02", section: "dice", language: "en",
    expected_class: "safety", state: "blocked", rendered_output: "Lumis can’t help with that request, but it can offer a safer, general reflection instead.",
    latency_bucket: "not_run", input_token_bucket: "not_run", output_token_bucket: "not_run", attempt_count: 0,
    result_class: "safety_redirect", retry_class: "not_eligible",
  }),
  parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, fixture_id: "DICE-FOUNDER-ZH-02", section: "dice", language: "zh-Hant",
    expected_class: "fallback", state: "fallback", rendered_output: "Lumis couldn’t complete that reflection just now. Please try again.",
    latency_bucket: "timeout", input_token_bucket: "401_to_800", output_token_bucket: "not_run", attempt_count: 2,
    result_class: "fixed_fallback", retry_class: "retried_once",
  }),
  createNotRunRecord("chat_en_reflection_01", "companion_chat", "descriptive"),
  parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, fixture_id: "chat_zh_hant_reflection_01", section: "companion_chat", language: "zh-Hant",
    expected_class: "descriptive", state: "offline_preview", rendered_output: "你可以先替現在的感受命名，再選一件今天能完成的小事。",
    latency_bucket: "not_run", input_token_bucket: "not_run", output_token_bucket: "not_run", attempt_count: 0,
    result_class: "completed", retry_class: "none",
  }),
] as const;

export type VerdictEntry = {
  fixture_id: string;
  ratings: ReviewRatings;
  verdict: "pending" | "accepted" | "returned";
};

export type FounderVerdictPayload = {
  schema_version: "s2_t256_founder_verdict_v1";
  review_contract_version: typeof FOUNDER_AI_REVIEW_SCHEMA_VERSION;
  build_sha: string;
  generated_from: "local_founder_console";
  entries: VerdictEntry[];
};

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function createVerdictPayload(buildSha: string, entries: VerdictEntry[]): FounderVerdictPayload {
  if (!/^[0-9a-f]{40}$/.test(buildSha)) throw new Error("STOP_S2_T251_BUILD_SHA");
  const seen = new Set<string>();
  const closed = entries.map((entry) => {
    const entryKeys = Object.keys(entry).sort();
    if (entryKeys.join(",") !== "fixture_id,ratings,verdict") throw new Error("STOP_S2_T251_VERDICT_FIELDS");
    if (seen.has(entry.fixture_id)) throw new Error("STOP_S2_T251_DUPLICATE_VERDICT");
    seen.add(entry.fixture_id);
    if (![...RESERVED_DICE_FOUNDER_IDS, ...LATER_CHAT_FIXTURE_IDS].includes(entry.fixture_id)) throw new Error("STOP_S2_T251_UNKNOWN_VERDICT_FIXTURE");
    if (!["pending", "accepted", "returned"].includes(entry.verdict)) throw new Error("STOP_S2_T251_VERDICT");
    const ratingKeys = Object.keys(entry.ratings).sort();
    if (ratingKeys.join(",") !== [...RATING_DIMENSIONS].sort().join(",")) throw new Error("STOP_S2_T251_RATING_FIELDS");
    for (const dimension of RATING_DIMENSIONS) {
      if (![1, 2, 3, 4, 5].includes(entry.ratings[dimension])) throw new Error("STOP_S2_T251_RATING");
    }
    return entry;
  });
  return { schema_version: "s2_t256_founder_verdict_v1", review_contract_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION, build_sha: buildSha, generated_from: "local_founder_console", entries: closed };
}

export type DraftDecision =
  | { ok: true; normalized_question: string; language: ReviewLanguage; classification: "judgment" | "descriptive" }
  | { ok: false; code: "QUESTION_EMPTY" | "QUESTION_TOO_SHORT" | "QUESTION_TOO_LONG" | "QUESTION_LANGUAGE_MISMATCH" | "QUESTION_PRIVATE_DATA" | "QUESTION_BUNDLED" | "QUESTION_UNSAFE" | "QUESTION_EXCLUDED" };

export type FrozenFounderQuestion = Readonly<{
  schema_version: "dice_founder_fixture_candidate_v1";
  fixture_id: string;
  language: ReviewLanguage;
  question: string;
  expected_route: "judgment" | "descriptive_reflection";
  review_status: "locally_frozen_pending_review";
  effects: Readonly<{ provider_calls: 0; persistence_writes: 0; units_consumed: 0 }>;
}>;

export function validateFounderDiceDraft(question: string, expectedLanguage: ReviewLanguage): DraftDecision {
  const normalized = question.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return { ok: false, code: "QUESTION_EMPTY" };
  if ([...normalized].length < 8) return { ok: false, code: "QUESTION_TOO_SHORT" };
  if ([...normalized].length > 280 || normalized.includes("\n")) return { ok: false, code: "QUESTION_TOO_LONG" };
  const language: ReviewLanguage = /[\u3400-\u9fff]/u.test(normalized) ? "zh-Hant" : "en";
  if (language !== expectedLanguage) return { ok: false, code: "QUESTION_LANGUAGE_MISMATCH" };
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:account|member|device|user)[ _-]?id\b|\b(?:birth(?:day|date| time)?|born on)\b|\b(?:my name is|call me)\b|\b\+?\d[\d ()-]{7,}\d\b/iu.test(normalized) ||
    /(姓名|電郵|帳戶編號|會員編號|裝置編號|出生日期|出生時間|電話號碼)/u.test(normalized)) return { ok: false, code: "QUESTION_PRIVATE_DATA" };
  if ((normalized.match(/[?？]/gu) ?? []).length > 1 || /\b(?:and also|as well as)\b/iu.test(normalized)) return { ok: false, code: "QUESTION_BUNDLED" };
  if (/\b(?:suicide|kill myself|diagnos|medication|legal advice|invest all)\b/iu.test(normalized) || /(自殺|傷害自己|診斷|停止服藥|法律意見|全部積蓄)/u.test(normalized)) return { ok: false, code: "QUESTION_UNSAFE" };
  if (/\b(?:natal chart|birth chart|body part|multi[- ]throw|past reflections|sharing card)\b/iu.test(normalized) || /(本命盤|出生盤|身體部位|多次擲骰|過往反思|分享卡)/u.test(normalized)) return { ok: false, code: "QUESTION_EXCLUDED" };
  const judgment = language === "zh-Hant"
    ? /^(?:我)?(?:應該|是否|可以|能否|會不會|現在適合)/u.test(normalized)
    : /^(?:should|is|are|can|could|will|would|may)\b/iu.test(normalized);
  return { ok: true, normalized_question: normalized, language, classification: judgment ? "judgment" : "descriptive" };
}

export function freezeFounderDiceDraft(fixtureId: string, decision: DraftDecision): FrozenFounderQuestion | null {
  if (!decision.ok || !RESERVED_DICE_FOUNDER_IDS.includes(fixtureId)) return null;
  const expectedLanguage: ReviewLanguage = fixtureId.includes("-ZH-") ? "zh-Hant" : "en";
  if (decision.language !== expectedLanguage) return null;
  return Object.freeze({
    schema_version: "dice_founder_fixture_candidate_v1",
    fixture_id: fixtureId,
    language: decision.language,
    question: decision.normalized_question,
    expected_route: decision.classification === "judgment" ? "judgment" : "descriptive_reflection",
    review_status: "locally_frozen_pending_review",
    effects: Object.freeze({ provider_calls: 0, persistence_writes: 0, units_consumed: 0 }),
  });
}

export type ClosedGatewayEvidence = Readonly<{
  schema_version: "founder_ai_gateway_evidence_v1";
  fixture_id: string;
  gateway: ReviewSection;
  language: ReviewLanguage;
  state: ReviewState;
  expected_class: ExpectedClass;
  result_class: SyntheticReviewRecord["result_class"];
  safe_rendered_output: string | null;
  latency_bucket: SyntheticReviewRecord["latency_bucket"];
  input_token_bucket: SyntheticReviewRecord["input_token_bucket"];
  output_token_bucket: SyntheticReviewRecord["output_token_bucket"];
  attempt_count: SyntheticReviewRecord["attempt_count"];
  retry_class: SyntheticReviewRecord["retry_class"];
  effects: Readonly<{ provider_calls: 0 | 1 | 2; persistence_writes: 0; units_charged: 0 }>;
}>;

export function parseClosedGatewayEvidence(input: unknown): SyntheticReviewRecord {
  if (!isObject(input)) throw new Error("STOP_S2_T256_EVIDENCE_NOT_OBJECT");
  const allowed = ["schema_version", "fixture_id", "gateway", "language", "state", "expected_class", "result_class", "safe_rendered_output", "latency_bucket", "input_token_bucket", "output_token_bucket", "attempt_count", "retry_class", "effects"];
  const keys = Object.keys(input).sort();
  if (keys.join(",") !== allowed.sort().join(",")) throw new Error("STOP_S2_T256_EVIDENCE_FIELDS");
  if (input.schema_version !== "founder_ai_gateway_evidence_v1" || !isObject(input.effects)) throw new Error("STOP_S2_T256_EVIDENCE_SCHEMA");
  if (Object.keys(input.effects).sort().join(",") !== "persistence_writes,provider_calls,units_charged" || input.effects.persistence_writes !== 0 || input.effects.units_charged !== 0 || ![0, 1, 2].includes(input.effects.provider_calls as number)) throw new Error("STOP_S2_T256_EVIDENCE_EFFECTS");
  return parseSyntheticReviewRecord({
    schema_version: FOUNDER_AI_REVIEW_SCHEMA_VERSION,
    fixture_id: input.fixture_id,
    section: input.gateway,
    language: input.language,
    expected_class: input.expected_class,
    state: input.state,
    rendered_output: input.safe_rendered_output,
    latency_bucket: input.latency_bucket,
    input_token_bucket: input.input_token_bucket,
    output_token_bucket: input.output_token_bucket,
    attempt_count: input.attempt_count,
    result_class: input.result_class,
    retry_class: input.retry_class,
  });
}
