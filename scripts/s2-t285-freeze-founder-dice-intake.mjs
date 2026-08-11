#!/usr/bin/env node
import { createHash } from "node:crypto";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const exact = (value, keys, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) throw new Error(code);
};

const text = await new Promise((resolve, reject) => {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; if (input.length > 200_000) reject(new Error("STOP_S2_T285_INPUT_TOO_LARGE")); });
  process.stdin.on("end", () => resolve(input));
  process.stdin.on("error", reject);
});

try {
  const envelope = JSON.parse(text);
  exact(envelope, ["payload", "sha256"], "STOP_S2_T285_ENVELOPE_FIELDS");
  exact(envelope.payload, ["schema_version", "build_sha", "registry_interface", "registry_checksum", "fixture_total", "language_totals", "runtime_request_fields", "authority_required", "fixtures", "effects"], "STOP_S2_T285_PACKAGE_FIELDS");
  const payload = envelope.payload;
  if (payload.schema_version !== "s2_t285_founder_dice_intake_v1" || !/^[0-9a-f]{40}$/.test(payload.build_sha) ||
      payload.registry_interface !== "dice-synthetic-registry-v0.3.0" || !/^[0-9a-f]{64}$/.test(payload.registry_checksum) ||
      payload.fixture_total !== 40 || !Array.isArray(payload.fixtures) || payload.fixtures.length !== 40 ||
      JSON.stringify(payload.runtime_request_fields) !== '["fixture_id"]' || envelope.sha256 !== sha256(canonical(payload))) throw new Error("STOP_S2_T285_PACKAGE_AUTHORITY");
  exact(payload.language_totals, ["en", "zh-Hant"], "STOP_S2_T285_LANGUAGE_FIELDS");
  exact(payload.authority_required, ["accepted_technical_80_evidence", "separate_founder_window_receipt"], "STOP_S2_T285_AUTHORITY_FIELDS");
  exact(payload.effects, ["provider_calls", "persistence_writes", "units_charged"], "STOP_S2_T285_EFFECT_FIELDS");
  if (payload.language_totals.en !== 20 || payload.language_totals["zh-Hant"] !== 20 ||
      payload.authority_required.accepted_technical_80_evidence !== true || payload.authority_required.separate_founder_window_receipt !== true ||
      payload.effects.provider_calls !== 0 || payload.effects.persistence_writes !== 0 || payload.effects.units_charged !== 0) throw new Error("STOP_S2_T285_COUNTS_OR_EFFECTS");

  const ids = new Set();
  const questionHashes = new Set();
  for (const fixture of payload.fixtures) {
    exact(fixture, ["fixture_id", "language", "question", "question_sha256", "expected_route", "review_status"], "STOP_S2_T285_FIXTURE_FIELDS");
    const expectedLanguage = fixture.fixture_id.includes("-ZH-") ? "zh-Hant" : "en";
    if (!/^DICE-FOUNDER-(?:EN|ZH)-(?:0[1-9]|1\d|20)$/.test(fixture.fixture_id) || fixture.language !== expectedLanguage ||
        typeof fixture.question !== "string" || fixture.question.length < 8 || fixture.question.length > 280 || fixture.question.includes("\n") ||
        fixture.question_sha256 !== sha256(fixture.question) || questionHashes.has(fixture.question_sha256) ||
        !["judgment", "descriptive_reflection"].includes(fixture.expected_route) || fixture.review_status !== "locally_frozen_pending_review") throw new Error("STOP_S2_T285_FIXTURE_AUTHORITY");
    if (/(?:https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:passport|address|credit card|bank account|birth date|account id|device id)\b|身份證|護照|信用卡|銀行帳戶|出生日期|帳戶編號|裝置編號)/iu.test(fixture.question)) throw new Error("STOP_S2_T285_FIXTURE_PRIVATE_DATA");
    ids.add(fixture.fixture_id);
    questionHashes.add(fixture.question_sha256);
  }
  if (ids.size !== 40) throw new Error("STOP_S2_T285_FIXTURE_SET");

  const registry = {
    schema_version: "s2_t285_server_frozen_dice_registry_v1",
    source_build_sha: payload.build_sha,
    source_intake_sha256: envelope.sha256,
    registry_interface: payload.registry_interface,
    fixture_total: 40,
    language_totals: { en: 20, "zh-Hant": 20 },
    runtime_request_fields: ["fixture_id"],
    fixtures: payload.fixtures.map(({ fixture_id, language, question, question_sha256, expected_route }) => ({ fixture_id, language, question, question_sha256, expected_route })),
    authority_status: "awaiting_accepted_technical_80_evidence_and_founder_window_receipt",
    effects: { provider_calls: 0, persistence_writes: 0, units_charged: 0 },
  };
  process.stdout.write(`${JSON.stringify({ payload: registry, sha256: sha256(canonical(registry)) }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "STOP_S2_T285_FREEZE_UNKNOWN"}\n`);
  process.exitCode = 1;
}
