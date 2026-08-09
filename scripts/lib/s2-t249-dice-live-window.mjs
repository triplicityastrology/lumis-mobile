import { createHash } from "node:crypto";

export const LIMITS = Object.freeze({
  logicalTotal: 120,
  technicalFirst: 80,
  founderAfterTechnical: 40,
  language: Object.freeze({ en: 60, "zh-Hant": 60 }),
  attempts: 240,
  inputTokens: 800,
  outputTokens: 300,
  concurrency: 2,
  deadlineMs: 12_000,
  retries: 1,
});

export const STATUS = Object.freeze([
  "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY",
  "NO_AZURE_TRAFFIC_AUTHORITY",
]);

export const RESULT_CLASSES = Object.freeze(["completed", "safety", "excluded", "fallback", "technical_error"]);
export const FAILURE_CODES = Object.freeze([
  "none", "safety_block", "scope_excluded", "provider_timeout", "provider_rate_limited",
  "provider_unavailable", "provider_malformed", "defaultv2_block", "defaultv2_partial",
]);
export const RETRYABLE_FAILURES = new Set(["provider_timeout", "provider_rate_limited", "provider_unavailable"]);

export const KILL_CODES = Object.freeze({
  gatewayDrift: "STOP_S2_T249_GATEWAY_DRIFT",
  configPre: "STOP_S2_T249_CONFIG_NOT_DISABLED_PRE",
  price: "STOP_S2_T249_PRICE_GATE_FAILED",
  authority: "STOP_S2_T249_WINDOW_NOT_AUTHORIZED",
  registry: "STOP_S2_T249_REGISTRY_ORDER_INVALID",
  logical: "STOP_S2_T249_LOGICAL_CAP",
  language: "STOP_S2_T249_LANGUAGE_CAP",
  attempts: "STOP_S2_T249_ATTEMPT_CAP",
  input: "STOP_S2_T249_INPUT_TOKEN_CAP",
  output: "STOP_S2_T249_OUTPUT_TOKEN_CAP",
  concurrency: "STOP_S2_T249_CONCURRENCY_CAP",
  deadline: "STOP_S2_T249_DEADLINE",
  retry: "STOP_S2_T249_RETRY_POLICY",
  unsafe: "STOP_S2_T249_UNSAFE_TELEMETRY",
  evidence: "STOP_S2_T249_EVIDENCE_INVALID",
  defaultV2: "STOP_S2_T249_DEFAULTV2_PROJECTION",
  disable: "STOP_S2_T249_PROVIDER_DISABLE_FAILED",
  configPost: "STOP_S2_T249_CONFIG_NOT_DISABLED_POST",
});

const SHA256 = /^[a-f0-9]{64}$/;
const RUN_ID = /^dice-window-[a-z0-9]{8,32}$/;
const FIXTURE_ID = /^(technical|founder)_(en|zh_hant)_([0-9]{3})$/;
const SAFE_KEYS = new Set([
  "schema", "run_id", "fixture_id", "phase", "language", "result_class", "counters",
  "attempt_count", "duration_bucket", "redacted_failure_code",
]);
const COUNTER_KEYS = new Set(["logical_total", "language_total", "attempt_total", "input_tokens", "output_tokens", "concurrency_peak"]);
const DURATIONS = new Set(["lt_1s", "1_to_4s", "4_to_8s", "8_to_12s", "not_called"]);

export class WindowStop extends Error {
  constructor(code) {
    super(code);
    this.name = "WindowStop";
    this.code = code;
  }
}

const stop = (code) => { throw new WindowStop(code); };
const exactKeys = (value, allowed, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  for (const key of Object.keys(value)) if (!allowed.has(key)) stop(code);
};
const integer = (value, min, max, code) => {
  if (!Number.isInteger(value) || value < min || value > max) stop(code);
};

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateGatewayDescriptor(value, expected = {}) {
  const keys = new Set(["interface_version", "route", "source_sha256", "fixture_registry_sha256", "response_schema", "prompt_version"]);
  exactKeys(value, keys, KILL_CODES.gatewayDrift);
  if (Object.keys(value).length !== keys.size || value.interface_version !== "dice_synthetic_gateway_port_v1" ||
      value.route !== "dice-synthetic-v0-3" || value.response_schema !== "dice_interpretation_response_v0_3" ||
      !SHA256.test(value.source_sha256) || !SHA256.test(value.fixture_registry_sha256) ||
      !/^dice_v0_3_[a-z0-9_]+$/.test(value.prompt_version)) stop(KILL_CODES.gatewayDrift);
  for (const [key, expectedValue] of Object.entries(expected)) if (value[key] !== expectedValue) stop(KILL_CODES.gatewayDrift);
  return Object.freeze({ ...value });
}

export function validateDisabledState(value, phase) {
  const keys = new Set(["interface_version", "lumis_ai_enabled", "provider_access", "route_default_off"]);
  const code = phase === "post" ? KILL_CODES.configPost : KILL_CODES.configPre;
  exactKeys(value, keys, code);
  if (Object.keys(value).length !== keys.size || value.interface_version !== "dice_synthetic_gateway_status_v1" ||
      value.lumis_ai_enabled !== false || value.provider_access !== false || value.route_default_off !== true) stop(code);
  return true;
}

export function validatePriceGate(value, now = new Date()) {
  const keys = new Set(["schema", "currency", "input_usd_per_million", "output_usd_per_million", "approved_window_cap_usd", "confirmed_by", "confirmed_at", "valid_until"]);
  exactKeys(value, keys, KILL_CODES.price);
  if (Object.keys(value).length !== keys.size || value.schema !== "s2_t249_live_price_confirmation_v1" || value.currency !== "USD" ||
      value.confirmed_by !== "microsoft_azure_review" || !Number.isFinite(value.input_usd_per_million) ||
      !Number.isFinite(value.output_usd_per_million) || !Number.isFinite(value.approved_window_cap_usd) ||
      value.input_usd_per_million < 0 || value.output_usd_per_million < 0 || value.approved_window_cap_usd <= 0) stop(KILL_CODES.price);
  const confirmedAt = Date.parse(value.confirmed_at);
  const validUntil = Date.parse(value.valid_until);
  if (!Number.isFinite(confirmedAt) || !Number.isFinite(validUntil) || confirmedAt > now.getTime() || validUntil <= now.getTime()) stop(KILL_CODES.price);
  const maxInput = LIMITS.attempts * LIMITS.inputTokens;
  const maxOutput = LIMITS.attempts * LIMITS.outputTokens;
  const calculatedMaxCostUsd = (maxInput * value.input_usd_per_million + maxOutput * value.output_usd_per_million) / 1_000_000;
  if (calculatedMaxCostUsd > value.approved_window_cap_usd) stop(KILL_CODES.price);
  return Object.freeze({ calculated_max_cost_usd: Number(calculatedMaxCostUsd.toFixed(6)), approved_window_cap_usd: value.approved_window_cap_usd });
}

export function validateAuthorization(value, expected) {
  const keys = new Set(["schema", "dice_window_authorized", "microsoft_review", "technical_review", "live_price_confirmed", "gateway_source_sha256", "fixture_registry_sha256", "single_use_run_id"]);
  exactKeys(value, keys, KILL_CODES.authority);
  if (Object.keys(value).length !== keys.size || value.schema !== "s2_t249_dice_window_authorization_v1" ||
      value.dice_window_authorized !== true || value.microsoft_review !== "approved" || value.technical_review !== "approved" ||
      value.live_price_confirmed !== true || value.gateway_source_sha256 !== expected.source_sha256 ||
      value.fixture_registry_sha256 !== expected.fixture_registry_sha256 || !RUN_ID.test(value.single_use_run_id)) stop(KILL_CODES.authority);
  return value.single_use_run_id;
}

export function validateRegistry(entries) {
  if (!Array.isArray(entries) || entries.length !== LIMITS.logicalTotal) stop(KILL_CODES.registry);
  const seen = new Set();
  const counts = { technical: { en: 0, "zh-Hant": 0 }, founder: { en: 0, "zh-Hant": 0 } };
  entries.forEach((entry, index) => {
    exactKeys(entry, new Set(["fixture_id", "phase", "language"]), KILL_CODES.registry);
    const match = FIXTURE_ID.exec(entry.fixture_id);
    if (!match || seen.has(entry.fixture_id) || !["technical", "founder"].includes(entry.phase) || !["en", "zh-Hant"].includes(entry.language)) stop(KILL_CODES.registry);
    const expectedPhase = index < LIMITS.technicalFirst ? "technical" : "founder";
    if (entry.phase !== expectedPhase || match[1] !== entry.phase || (match[2] === "zh_hant" ? "zh-Hant" : match[2]) !== entry.language) stop(KILL_CODES.registry);
    seen.add(entry.fixture_id);
    counts[entry.phase][entry.language] += 1;
  });
  if (counts.technical.en !== 40 || counts.technical["zh-Hant"] !== 40 || counts.founder.en !== 20 || counts.founder["zh-Hant"] !== 20) stop(KILL_CODES.registry);
  return entries.map((entry) => Object.freeze({ ...entry }));
}

export function validateEvidence(value) {
  exactKeys(value, SAFE_KEYS, KILL_CODES.evidence);
  if (Object.keys(value).length !== SAFE_KEYS.size || value.schema !== "s2_t249_dice_window_evidence_v1" ||
      !RUN_ID.test(value.run_id) || !FIXTURE_ID.test(value.fixture_id) || !["technical", "founder"].includes(value.phase) ||
      !["en", "zh-Hant"].includes(value.language) || !RESULT_CLASSES.includes(value.result_class) ||
      !DURATIONS.has(value.duration_bucket) || !FAILURE_CODES.includes(value.redacted_failure_code)) stop(KILL_CODES.evidence);
  exactKeys(value.counters, COUNTER_KEYS, KILL_CODES.evidence);
  if (Object.keys(value.counters).length !== COUNTER_KEYS.size) stop(KILL_CODES.evidence);
  integer(value.counters.logical_total, 1, LIMITS.logicalTotal, KILL_CODES.logical);
  integer(value.counters.language_total, 1, 60, KILL_CODES.language);
  integer(value.counters.attempt_total, 0, LIMITS.attempts, KILL_CODES.attempts);
  integer(value.counters.input_tokens, 0, LIMITS.inputTokens, KILL_CODES.input);
  integer(value.counters.output_tokens, 0, LIMITS.outputTokens, KILL_CODES.output);
  integer(value.counters.concurrency_peak, 0, LIMITS.concurrency, KILL_CODES.concurrency);
  integer(value.attempt_count, 0, 2, KILL_CODES.attempts);
  if (value.attempt_count === 2 && !RETRYABLE_FAILURES.has(value.redacted_failure_code) && value.result_class !== "completed") stop(KILL_CODES.retry);
  if (["defaultv2_block", "defaultv2_partial"].includes(value.redacted_failure_code) && value.result_class !== "safety") stop(KILL_CODES.defaultV2);
  if (value.attempt_count === 0 && value.duration_bucket !== "not_called") stop(KILL_CODES.evidence);
  return Object.freeze(structuredClone(value));
}

export function validateEvidencePackage(value, expected) {
  const keys = new Set(["schema", "run_id", "gateway_source_sha256", "fixture_registry_sha256", "price_confirmation_sha256", "logical_total", "attempt_total", "language", "technical_evidence_valid", "founder_phase_ran", "provider_disabled_verified", "records"]);
  exactKeys(value, keys, KILL_CODES.evidence);
  if (Object.keys(value).length !== keys.size || value.schema !== "s2_t249_dice_window_evidence_package_v1" ||
      !RUN_ID.test(value.run_id) || value.gateway_source_sha256 !== expected.source_sha256 ||
      value.fixture_registry_sha256 !== expected.fixture_registry_sha256 || !SHA256.test(value.price_confirmation_sha256) ||
      value.logical_total !== LIMITS.logicalTotal || !Number.isInteger(value.attempt_total) || value.attempt_total < 0 || value.attempt_total > LIMITS.attempts ||
      value.technical_evidence_valid !== true || value.founder_phase_ran !== true || value.provider_disabled_verified !== true ||
      !value.language || Object.keys(value.language).sort().join(",") !== "en,zh-Hant" ||
      value.language.en !== 60 || value.language["zh-Hant"] !== 60 || !Array.isArray(value.records) || value.records.length !== LIMITS.logicalTotal) stop(KILL_CODES.evidence);
  const seen = new Set();
  value.records.forEach((record, index) => {
    validateEvidence(record);
    if (record.run_id !== value.run_id || seen.has(record.fixture_id) || (index < 80 ? record.phase !== "technical" : record.phase !== "founder")) stop(KILL_CODES.evidence);
    seen.add(record.fixture_id);
  });
  if (value.records.at(-1).counters.attempt_total !== value.attempt_total) stop(KILL_CODES.evidence);
  return Object.freeze(structuredClone(value));
}

function validateGatewayResult(result) {
  const keys = new Set(["result_class", "attempt_count", "input_tokens", "output_tokens", "duration_ms", "concurrency_peak", "redacted_failure_code"]);
  exactKeys(result, keys, KILL_CODES.unsafe);
  if (Object.keys(result).length !== keys.size || !RESULT_CLASSES.includes(result.result_class) || !FAILURE_CODES.includes(result.redacted_failure_code)) stop(KILL_CODES.unsafe);
  integer(result.attempt_count, 0, 2, KILL_CODES.attempts);
  integer(result.input_tokens, 0, LIMITS.inputTokens, KILL_CODES.input);
  integer(result.output_tokens, 0, LIMITS.outputTokens, KILL_CODES.output);
  integer(result.concurrency_peak, 0, LIMITS.concurrency, KILL_CODES.concurrency);
  if (!Number.isFinite(result.duration_ms) || result.duration_ms < 0 || result.duration_ms > LIMITS.deadlineMs) stop(KILL_CODES.deadline);
  if (result.attempt_count === 2 && !RETRYABLE_FAILURES.has(result.redacted_failure_code) && result.result_class !== "completed") stop(KILL_CODES.retry);
  if (["defaultv2_block", "defaultv2_partial"].includes(result.redacted_failure_code) && result.result_class !== "safety") stop(KILL_CODES.defaultV2);
  return result;
}

const durationBucket = (ms, attempts) => attempts === 0 ? "not_called" : ms < 1000 ? "lt_1s" : ms < 4000 ? "1_to_4s" : ms < 8000 ? "4_to_8s" : "8_to_12s";

export async function runControlledWindow({ gateway, registry, price, authorization, expectedGateway = {}, onEvidence = () => {} }) {
  if (!gateway || typeof gateway.describe !== "function" || typeof gateway.status !== "function" || typeof gateway.enableSyntheticWindow !== "function" || typeof gateway.invokeFixture !== "function" || typeof gateway.disable !== "function") stop(KILL_CODES.gatewayDrift);
  const descriptor = validateGatewayDescriptor(await gateway.describe(), expectedGateway);
  validateDisabledState(await gateway.status(), "pre");
  const priceResult = validatePriceGate(price);
  const runId = validateAuthorization(authorization, descriptor);
  const cases = validateRegistry(registry);
  const evidence = [];
  let attemptTotal = 0;
  let logicalTotal = 0;
  const languageTotal = { en: 0, "zh-Hant": 0 };
  let liveStateBegan = false;
  let originalError;
  let cleanupError;
  try {
    liveStateBegan = true;
    await gateway.enableSyntheticWindow({ run_id: runId });
    for (const entry of cases) {
      if (entry.phase === "founder" && evidence.length < LIMITS.technicalFirst) stop(KILL_CODES.registry);
      logicalTotal += 1;
      languageTotal[entry.language] += 1;
      if (logicalTotal > LIMITS.logicalTotal) stop(KILL_CODES.logical);
      if (languageTotal[entry.language] > LIMITS.language[entry.language]) stop(KILL_CODES.language);
      const result = validateGatewayResult(await gateway.invokeFixture({ interface_version: descriptor.interface_version, run_id: runId, fixture_id: entry.fixture_id }));
      attemptTotal += result.attempt_count;
      if (attemptTotal > LIMITS.attempts) stop(KILL_CODES.attempts);
      const item = validateEvidence({
        schema: "s2_t249_dice_window_evidence_v1",
        run_id: runId,
        fixture_id: entry.fixture_id,
        phase: entry.phase,
        language: entry.language,
        result_class: result.result_class,
        counters: {
          logical_total: logicalTotal,
          language_total: languageTotal[entry.language],
          attempt_total: attemptTotal,
          input_tokens: result.input_tokens,
          output_tokens: result.output_tokens,
          concurrency_peak: result.concurrency_peak,
        },
        attempt_count: result.attempt_count,
        duration_bucket: durationBucket(result.duration_ms, result.attempt_count),
        redacted_failure_code: result.redacted_failure_code,
      });
      evidence.push(item);
      await onEvidence(item);
    }
  } catch (error) {
    originalError = error;
  } finally {
    if (liveStateBegan) {
      try { await gateway.disable({ run_id: runId }); }
      catch { cleanupError = new WindowStop(KILL_CODES.disable); }
      try { validateDisabledState(await gateway.status(), "post"); }
      catch { cleanupError = new WindowStop(KILL_CODES.configPost); }
    }
  }
  if (cleanupError) throw cleanupError;
  if (originalError) throw originalError;
  if (evidence.length !== LIMITS.logicalTotal || attemptTotal > LIMITS.attempts) stop(KILL_CODES.evidence);
  return Object.freeze({
    status: "WINDOW_COMPLETE_PROVIDER_DISABLED",
    run_id: runId,
    logical_total: evidence.length,
    attempt_total: attemptTotal,
    language: Object.freeze({ ...languageTotal }),
    calculated_max_cost_usd: priceResult.calculated_max_cost_usd,
    provider_disabled_verified: true,
    evidence: Object.freeze(evidence),
  });
}
