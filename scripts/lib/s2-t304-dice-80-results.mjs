import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { TechnicalWindowStop } from "./s2-t289-dice-technical-window.mjs";
import { STOP as T294_STOP, loadControl as loadT294, runControlRoom } from "./s2-t294-dice-control-room.mjs";

export const STOP = Object.freeze({
  ...T294_STOP,
  source: "STOP_S2_T304_SOURCE_OR_AUTHORITY_DRIFT",
  ratings: "STOP_S2_T304_RATINGS_INVALID",
  review: "STOP_S2_T304_REVIEW_PACKAGE_INVALID",
  input: "KILL_S2_T304_INPUT_TOKEN_CAP",
  output: "KILL_S2_T304_OUTPUT_TOKEN_CAP",
  deadline: "KILL_S2_T304_SHARED_DEADLINE",
  rate: "KILL_S2_T304_PROVIDER_RATE_LIMITED_AFTER_RETRY",
  unavailable: "KILL_S2_T304_PROVIDER_UNAVAILABLE_AFTER_RETRY",
  malformed: "KILL_S2_T304_PROVIDER_OUTPUT_INVALID",
  budget: "KILL_S2_T304_COST_OR_ATTEMPT_BUDGET",
  disable: "KILL_S2_T304_DISABLE_NOT_PROVEN"
});

const DIMENSIONS = Object.freeze(["authority", "relevance", "tone", "language_quality", "safety"]);
const FORBIDDEN = ["prompt", "response", "question", "member_id", "account_id", "device_id", "endpoint", "api_key", "secret", "raw_error", "birth_data"];
const SAFE_FAILURES = new Set(["none", "safety_block", "scope_excluded", "defaultv2_block", "defaultv2_partial"]);
const KILL_FAILURES = new Map([
  ["input_token_cap", STOP.input],
  ["output_token_cap", STOP.output],
  ["provider_timeout", STOP.deadline],
  ["provider_rate_limited", STOP.rate],
  ["provider_unavailable", STOP.unavailable],
  ["provider_malformed", STOP.malformed]
]);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const stop = (code) => { throw new TechnicalWindowStop(code); };
const exact = (value, keys, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) stop(code);
};
const latestEvidence = (record) => record.attempts.findLast((attempt) => attempt.state === "completed")?.evidence;
const bucket = (value, low, high) => value === 0 ? "0" : value <= low ? `1_${low}` : value <= high ? `${low + 1}_${high}` : "over_cap";

export function loadControl(root = process.cwd()) {
  const control = JSON.parse(readFileSync(resolve(root, "config/s2-t304-dice-80-results.json"), "utf8"));
  const inherited = loadT294(root);
  if (control.schema !== "s2_t304_dice_80_results_control_v1" ||
      control.base_commit !== "8028dd5adc2282f284f037e3db10aaf9827c0e65" ||
      control.deployment_authority.canonical_commit !== "dcbf25b8813ff3f1bcbc0262831ee0f5fb5d4432" ||
      control.deployment_authority.zero_call_package_commit !== "69c3de399acf3fa9ec746deaeb7a1880128955ca" ||
      control.deployment_authority.authorization_schema !== inherited.t289.deployment.schema ||
      control.deployment_authority.runtime_package_sha256 !== inherited.t289.deployment.runtime_package_sha256 ||
      control.migration_boundary.authorization_scope !== inherited.t289.migration.authorization_scope ||
      control.migration_boundary.proof_receipt_sha256 !== inherited.t289.migration.proof_receipt_sha256 ||
      control.required_receipts.join("|") !== inherited.control.receipt_order.join("|") ||
      control.limits.technical_cases !== 80 || control.limits.en !== 40 || control.limits.zh_hant !== 40 ||
      control.limits.founder_cases !== 0 || control.limits.attempts !== 160 || control.limits.concurrency !== 2 ||
      control.limits.eligible_retries !== 1 || control.limits.shared_deadline_ms !== 12000 ||
      control.limits.input_tokens !== 800 || control.limits.output_tokens !== 300 ||
      control.limits.tokenizer !== "js-tiktoken@1.0.21/o200k_base" || control.limits.cost_ceiling_usd !== 0.128 ||
      control.limits.input_price_usd_per_1m_tokens !== 0.25 || control.limits.output_price_usd_per_1m_tokens !== 2 ||
      JSON.stringify(control.review_dimensions) !== JSON.stringify(DIMENSIONS) ||
      JSON.stringify(control.authority_status) !== JSON.stringify(["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"])) stop(STOP.source);
  return { control, t294: inherited.control, t289: inherited.t289, registry: inherited.registry };
}

export function validateRatings(value, registry) {
  if (!Array.isArray(value) || value.length !== 80) stop(STOP.ratings);
  const seen = new Set();
  return value.map((rating, index) => {
    exact(rating, ["fixture_id", ...DIMENSIONS], STOP.ratings);
    if (rating.fixture_id !== registry.fixtures[index].fixture_id || seen.has(rating.fixture_id)) stop(STOP.ratings);
    for (const dimension of DIMENSIONS) if (!Number.isInteger(rating[dimension]) || rating[dimension] < 1 || rating[dimension] > 5) stop(STOP.ratings);
    seen.add(rating.fixture_id);
    return Object.freeze({ ...rating });
  });
}

export function evaluateKillCriteria(journal, control) {
  if (journal.provider_disabled_verified !== true) return STOP.disable;
  const evidence = journal.records.map(latestEvidence).filter(Boolean);
  const attempts = evidence.reduce((sum, item) => sum + item.attempt_count, 0);
  const inputTokens = evidence.reduce((sum, item) => sum + item.input_tokens, 0);
  const outputTokens = evidence.reduce((sum, item) => sum + item.output_tokens, 0);
  const cost = inputTokens / 1_000_000 * control.limits.input_price_usd_per_1m_tokens + outputTokens / 1_000_000 * control.limits.output_price_usd_per_1m_tokens;
  if (attempts > 160 || cost > 0.128 || evidence.some((item) => item.concurrency_peak > 2 || item.attempt_count > 2)) return STOP.budget;
  for (const item of evidence) {
    if (item.input_tokens > 800) return STOP.input;
    if (item.output_tokens > 300) return STOP.output;
    if (item.duration_ms > 12000) return STOP.deadline;
    if (KILL_FAILURES.has(item.redacted_failure_code)) return KILL_FAILURES.get(item.redacted_failure_code);
    if (!SAFE_FAILURES.has(item.redacted_failure_code)) return STOP.review;
  }
  return null;
}

export function guardGateway(gateway) {
  if (!gateway || typeof gateway.status !== "function" || typeof gateway.executeFixture !== "function" || typeof gateway.disable !== "function") stop(STOP.source);
  return {
    status: (...args) => gateway.status(...args),
    disable: (...args) => gateway.disable(...args),
    killRequested: typeof gateway.killRequested === "function" ? (...args) => gateway.killRequested(...args) : undefined,
    async executeFixture(args) {
      const evidence = await gateway.executeFixture(args);
      if (evidence?.input_tokens > 800) stop(STOP.input);
      if (evidence?.output_tokens > 300) stop(STOP.output);
      if (evidence?.duration_ms > 12000) stop(STOP.deadline);
      if (evidence?.attempt_count > 2 || evidence?.concurrency_peak > 2) stop(STOP.budget);
      if (KILL_FAILURES.has(evidence?.redacted_failure_code)) stop(KILL_FAILURES.get(evidence.redacted_failure_code));
      return evidence;
    }
  };
}

export function createReviewPackage(journal, control, ratings, ratingSource = "founder_review_pending") {
  const { registry } = loadControl();
  const acceptedRatings = validateRatings(ratings, registry);
  if (journal.state !== "completed" || journal.records.length !== 80) stop(STOP.review);
  const kill = evaluateKillCriteria(journal, control);
  if (kill) stop(kill);
  const rows = journal.records.map((record, index) => {
    const evidence = latestEvidence(record);
    if (!evidence) stop(STOP.review);
    const rating = acceptedRatings[index];
    const score = DIMENSIONS.reduce((sum, dimension) => sum + rating[dimension], 0) / DIMENSIONS.length;
    const failed = ["fallback", "technical_error"].includes(evidence.result_class);
    const weak = !failed && (score < 3.5 || DIMENSIONS.some((dimension) => rating[dimension] <= 2));
    const reasons = failed ? [evidence.result_class, evidence.redacted_failure_code] : weak ? DIMENSIONS.filter((dimension) => rating[dimension] <= 2) : [];
    return {
      fixture_id: record.fixture_id,
      language: record.language,
      disposition: evidence.result_class,
      failure_code: evidence.redacted_failure_code,
      latency_bucket: evidence.duration_ms < 1000 ? "under_1s" : evidence.duration_ms < 5000 ? "1_to_5s" : "5_to_12s",
      attempts: evidence.attempt_count,
      input_token_bucket: bucket(evidence.input_tokens, 400, 800),
      output_token_bucket: bucket(evidence.output_tokens, 150, 300),
      ratings: Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, rating[dimension]])),
      score: Number(score.toFixed(1)),
      review_class: failed ? "failed" : weak ? "weak" : "meets_bar",
      review_reasons: reasons
    };
  });
  const failed = rows.filter((row) => row.review_class === "failed").map(({ fixture_id, language, disposition, failure_code }) => ({ fixture_id, language, disposition, failure_code }));
  const weak = rows.filter((row) => row.review_class === "weak").map(({ fixture_id, language, score, review_reasons }) => ({ fixture_id, language, score, review_reasons }));
  const review = {
    schema: "s2_t304_dice_technical_results_review_v1",
    evidence_class: "local_zero_network_rehearsal_only",
    rating_source: ratingSource,
    live_azure_proof: false,
    run_id: journal.run_id,
    status: "completed",
    authority_status: ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"],
    limits: { technical_cases: 80, en: 40, zh_hant: 40, max_attempts: 160, concurrency: 2, eligible_retries: 1, shared_deadline_ms: 12000, input_tokens: 800, output_tokens: 300, cost_ceiling_usd: 0.128 },
    summary: { reviewed: 80, meets_bar: rows.filter((row) => row.review_class === "meets_bar").length, weak: weak.length, failed: failed.length, provider_disabled_verified: true },
    failed_answers: failed,
    weak_answers: weak,
    rows
  };
  const serialized = JSON.stringify(review).toLowerCase();
  if (FORBIDDEN.some((term) => serialized.includes(term)) || rows.length !== 80 || rows.filter((row) => row.language === "en").length !== 40 || rows.filter((row) => row.language === "zh-Hant").length !== 40) stop(STOP.review);
  return review;
}

export function createFounderMarkdown(review) {
  return [
    "# Dice Technical 80-case review",
    "",
    `Status: ${review.evidence_class}. This is not live Azure proof.`,
    `Reviewed: ${review.summary.reviewed}; meets bar: ${review.summary.meets_bar}; weak: ${review.summary.weak}; failed: ${review.summary.failed}.`,
    `Provider disabled afterward: ${review.summary.provider_disabled_verified ? "yes" : "no"}.`,
    "",
    "## Failed answers",
    ...(review.failed_answers.length ? review.failed_answers.map((item) => `- ${item.fixture_id} (${item.language}): ${item.disposition}/${item.failure_code}`) : ["- None."]),
    "",
    "## Weak answers",
    ...(review.weak_answers.length ? review.weak_answers.map((item) => `- ${item.fixture_id} (${item.language}): score ${item.score}; ${item.review_reasons.join(", ") || "manual review"}`) : ["- None."]),
    "",
    "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
    "NO_AZURE_TRAFFIC_AUTHORITY",
    ""
  ].join("\n");
}

export function validateReviewPackage(review, root = process.cwd()) {
  const { registry } = loadControl(root);
  exact(review, ["schema", "evidence_class", "rating_source", "live_azure_proof", "run_id", "status", "authority_status", "limits", "summary", "failed_answers", "weak_answers", "rows"], STOP.review);
  exact(review.limits, ["technical_cases", "en", "zh_hant", "max_attempts", "concurrency", "eligible_retries", "shared_deadline_ms", "input_tokens", "output_tokens", "cost_ceiling_usd"], STOP.review);
  exact(review.summary, ["reviewed", "meets_bar", "weak", "failed", "provider_disabled_verified"], STOP.review);
  if (review.schema !== "s2_t304_dice_technical_results_review_v1" || review.evidence_class !== "local_zero_network_rehearsal_only" || review.live_azure_proof !== false || review.status !== "completed" ||
      !Array.isArray(review.rows) || review.rows.length !== 80 || !Array.isArray(review.failed_answers) || !Array.isArray(review.weak_answers) ||
      JSON.stringify(review.authority_status) !== JSON.stringify(["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]) ||
      review.limits.technical_cases !== 80 || review.limits.en !== 40 || review.limits.zh_hant !== 40 || review.limits.max_attempts !== 160 || review.limits.concurrency !== 2 || review.limits.eligible_retries !== 1 || review.limits.shared_deadline_ms !== 12000 || review.limits.input_tokens !== 800 || review.limits.output_tokens !== 300 || review.limits.cost_ceiling_usd !== 0.128 ||
      review.summary.reviewed !== 80 || review.summary.provider_disabled_verified !== true || review.summary.meets_bar + review.summary.weak + review.summary.failed !== 80) stop(STOP.review);
  review.rows.forEach((row, index) => {
    exact(row, ["fixture_id", "language", "disposition", "failure_code", "latency_bucket", "attempts", "input_token_bucket", "output_token_bucket", "ratings", "score", "review_class", "review_reasons"], STOP.review);
    exact(row.ratings, DIMENSIONS, STOP.review);
    if (row.fixture_id !== registry.fixtures[index].fixture_id || row.language !== registry.fixtures[index].language || !["failed", "weak", "meets_bar"].includes(row.review_class) || !Array.isArray(row.review_reasons)) stop(STOP.review);
    for (const dimension of DIMENSIONS) if (!Number.isInteger(row.ratings[dimension]) || row.ratings[dimension] < 1 || row.ratings[dimension] > 5) stop(STOP.review);
  });
  review.failed_answers.forEach((item) => exact(item, ["fixture_id", "language", "disposition", "failure_code"], STOP.review));
  review.weak_answers.forEach((item) => exact(item, ["fixture_id", "language", "score", "review_reasons"], STOP.review));
  const expectedFailed = review.rows.filter((row) => row.review_class === "failed").map((row) => row.fixture_id);
  const expectedWeak = review.rows.filter((row) => row.review_class === "weak").map((row) => row.fixture_id);
  if (review.summary.failed !== expectedFailed.length || review.summary.weak !== expectedWeak.length || JSON.stringify(review.failed_answers.map((item) => item.fixture_id)) !== JSON.stringify(expectedFailed) || JSON.stringify(review.weak_answers.map((item) => item.fixture_id)) !== JSON.stringify(expectedWeak) || FORBIDDEN.some((term) => JSON.stringify(review).toLowerCase().includes(term))) stop(STOP.review);
  return review;
}

export async function runTechnicalResults({ gateway, receipts, journalPath, ratings, root = process.cwd(), now = () => Date.now(), onProgress = () => {} }) {
  const loaded = loadControl(root);
  const run = await runControlRoom({ gateway: guardGateway(gateway), receipts, journalPath, root, now, onProgress });
  const review = createReviewPackage(run.journal, loaded.control, ratings, "zero_network_synthetic_rehearsal");
  return { ...run, review, review_sha256: hash(`${JSON.stringify(review, null, 2)}\n`) };
}

export function writeReviewFiles({ jsonPath, markdownPath, review }) {
  validateReviewPackage(review);
  mkdirSync(dirname(jsonPath), { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  const json = `${JSON.stringify(review, null, 2)}\n`;
  const markdown = createFounderMarkdown(review);
  for (const [path, text] of [[jsonPath, json], [markdownPath, markdown]]) {
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, text, { mode: 0o600 });
    renameSync(temporary, path);
  }
  return { json_sha256: hash(json), markdown_sha256: hash(markdown) };
}
