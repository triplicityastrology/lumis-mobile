import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  STOP as T289_STOP,
  TechnicalWindowStop,
  loadAndValidateControl as loadT289,
  validateDeploymentReceipt,
  validateMigrationReceipt,
  validateTrafficAuthority,
  validateProviderEvidence,
} from "./s2-t289-dice-technical-window.mjs";

export const STOP = Object.freeze({
  ...T289_STOP,
  journal: "STOP_S2_T294_JOURNAL_INVALID",
  ambiguous: "STOP_S2_T294_AMBIGUOUS_DISPATCH_REQUIRES_REVIEW",
  killed: "STOP_S2_T294_KILL_REQUESTED",
  budget: "STOP_S2_T294_BUDGET_EXHAUSTED",
  disable: "STOP_S2_T294_DISABLE_NOT_PROVEN",
  export: "STOP_S2_T294_REDACTED_EXPORT_INVALID",
});

const SHA = /^[a-f0-9]{64}$/;
const RUN = /^dice-tech80-[a-z0-9]{16,40}$/;
const ATTEMPT = /^attempt-[a-f0-9-]{36}$/;
const FORBIDDEN = ["prompt", "response", "question", "member", "account", "device", "endpoint", "secret", "token_value", "raw_error"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const stop = (code) => { throw new TechnicalWindowStop(code); };
const exact = (value, keys, code = STOP.journal) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  const actual = Object.keys(value).sort();
  const wanted = [...keys].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) stop(code);
};

export function loadControl(root = process.cwd()) {
  const control = JSON.parse(readFileSync(resolve(root, "config/s2-t294-dice-80-control-room.json"), "utf8"));
  const { control: t289, registry } = loadT289(root);
  if (control.schema !== "s2_t294_dice_80_control_room_v1" ||
      control.base_commit !== "4b2c8c7578773b59b04d4e44ef4ca2dc57b7555f" ||
      control.runtime_package_sha256 !== t289.deployment.runtime_package_sha256 ||
      control.migration_proof_receipt_sha256 !== t289.migration.proof_receipt_sha256 ||
      control.resume_policy !== "never_repeat_dispatched_or_completed_provider_attempts" ||
      control.limits.technical_cases !== 80 || control.limits.en !== 40 || control.limits.zh_hant !== 40 ||
      control.limits.attempts !== 160 || control.limits.concurrency !== 2 ||
      control.limits.input_tokens !== 800 || control.limits.output_tokens !== 300 ||
      control.limits.cost_ceiling_usd !== 0.128) stop(T289_STOP.source);
  return { control, t289, registry };
}

export function validateReceipts({ deployment, migration, traffic }, root = process.cwd(), now = Date.now()) {
  const { control, t289, registry } = loadControl(root);
  const acceptedDeployment = validateDeploymentReceipt(deployment, t289, now);
  const acceptedMigration = validateMigrationReceipt(migration, t289, now);
  const acceptedTraffic = validateTrafficAuthority(traffic, t289, acceptedDeployment, acceptedMigration, now);
  return { control, t289, registry, deployment: acceptedDeployment, migration: acceptedMigration, traffic: acceptedTraffic };
}

export function createJournal({ traffic, registry, now = Date.now() }) {
  return {
    schema: "s2_t294_dice_technical_run_journal_v1",
    run_id: traffic.single_use_run_id,
    state: "ready",
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    kill_requested: false,
    provider_disabled_verified: true,
    records: registry.fixtures.map((fixture) => ({ fixture_id: fixture.fixture_id, language: fixture.language, state: "pending", attempts: [] })),
  };
}

export function validateJournal(journal, registry) {
  exact(journal, ["schema", "run_id", "state", "created_at", "updated_at", "kill_requested", "provider_disabled_verified", "records"]);
  if (journal.schema !== "s2_t294_dice_technical_run_journal_v1" || !RUN.test(journal.run_id) ||
      !["ready", "running", "stopped", "completed", "needs_review"].includes(journal.state) ||
      typeof journal.kill_requested !== "boolean" || typeof journal.provider_disabled_verified !== "boolean" ||
      !Array.isArray(journal.records) || journal.records.length !== 80) stop(STOP.journal);
  const seenAttempts = new Set();
  journal.records.forEach((record, index) => {
    exact(record, ["fixture_id", "language", "state", "attempts"]);
    const fixture = registry.fixtures[index];
    if (record.fixture_id !== fixture.fixture_id || record.language !== fixture.language || !["pending", "running", "completed", "stopped"].includes(record.state) || !Array.isArray(record.attempts) || record.attempts.length > 2) stop(STOP.journal);
    for (const attempt of record.attempts) {
      exact(attempt, ["attempt_id", "ordinal", "state", "reserved_at", "completed_at", "evidence"]);
      if (!ATTEMPT.test(attempt.attempt_id) || seenAttempts.has(attempt.attempt_id) || attempt.ordinal < 1 || attempt.ordinal > 2 || !["dispatched", "completed", "not_dispatched"].includes(attempt.state)) stop(STOP.journal);
      if (attempt.state === "completed" && (!attempt.completed_at || !attempt.evidence)) stop(STOP.journal);
      if (attempt.state !== "completed" && (attempt.completed_at !== null || attempt.evidence !== null)) stop(STOP.journal);
      seenAttempts.add(attempt.attempt_id);
    }
  });
  return journal;
}

export function writeJournal(path, journal) {
  mkdirSync(dirname(path), { recursive: true });
  const text = `${JSON.stringify(journal, null, 2)}\n`;
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, text, { mode: 0o600 });
  renameSync(temporary, path);
  return hash(text);
}

export function readJournal(path, registry) {
  return validateJournal(JSON.parse(readFileSync(path, "utf8")), registry);
}

export function summarize(journal, control) {
  const attempts = journal.records.flatMap((record) => record.attempts);
  const completedAttempts = attempts.filter((attempt) => attempt.state === "completed");
  const dispatched = attempts.filter((attempt) => attempt.state === "dispatched").length;
  const providerAttempts = completedAttempts.reduce((sum, attempt) => sum + attempt.evidence.attempt_count, 0) + dispatched * 2;
  const completed = journal.records.filter((record) => record.state === "completed").length;
  const inputTokens = completedAttempts.reduce((sum, attempt) => sum + (attempt.evidence?.input_tokens ?? 0), 0);
  const outputTokens = completedAttempts.reduce((sum, attempt) => sum + (attempt.evidence?.output_tokens ?? 0), 0);
  const costUsd = inputTokens / 1_000_000 * control.limits.input_price_usd_per_1m_tokens + outputTokens / 1_000_000 * control.limits.output_price_usd_per_1m_tokens;
  const active = journal.records.filter((record) => record.state === "running").length;
  return { completed, remaining: 80 - completed, attempts: providerAttempts, dispatched, active, concurrency_limit: 2, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: Number(costUsd.toFixed(6)), cost_ceiling_usd: 0.128, kill_requested: journal.kill_requested, provider_disabled_verified: journal.provider_disabled_verified };
}

const isDisabled = (status) => status?.interface_version === "dice_synthetic_gateway_status_v1" && status.lumis_ai_enabled === false && status.provider_access === false && status.route_default_off === true && status.active_run_id === null;

export async function runControlRoom({ gateway, receipts, journalPath, root = process.cwd(), now = () => Date.now(), onProgress = () => {} }) {
  const accepted = validateReceipts(receipts, root, now());
  let journal;
  try { journal = readJournal(journalPath, accepted.registry); }
  catch (error) { if (error?.code !== "ENOENT") throw error; journal = createJournal({ traffic: accepted.traffic, registry: accepted.registry, now: now() }); }
  if (journal.run_id !== accepted.traffic.single_use_run_id) stop(STOP.replay);
  if (journal.records.some((record) => record.attempts.some((attempt) => attempt.state === "dispatched"))) {
    journal.state = "needs_review"; journal.provider_disabled_verified = false; writeJournal(journalPath, journal); stop(STOP.ambiguous);
  }
  if (!isDisabled(await gateway.status())) stop(T289_STOP.deployment);
  journal.state = "running"; journal.provider_disabled_verified = false; journal.updated_at = new Date(now()).toISOString(); writeJournal(journalPath, journal);
  let original;
  try {
    let cursor = 0; let firstError;
    const worker = async () => {
      while (!firstError) {
        while (cursor < 80 && journal.records[cursor].state === "completed") cursor += 1;
        const index = cursor; cursor += 1;
        if (index >= 80) return;
        const fixture = accepted.registry.fixtures[index]; const record = journal.records[index];
        try {
          if (journal.kill_requested || await gateway.killRequested?.(journal.run_id)) { journal.kill_requested = true; journal.state = "stopped"; stop(STOP.killed); }
          if (record.attempts.length >= 2 || summarize(journal, accepted.control).attempts + 2 > 160) stop(STOP.budget);
          record.state = "running";
          const attempt = { attempt_id: `attempt-${randomUUID()}`, ordinal: record.attempts.length + 1, state: "dispatched", reserved_at: new Date(now()).toISOString(), completed_at: null, evidence: null };
          record.attempts.push(attempt); journal.updated_at = new Date(now()).toISOString(); writeJournal(journalPath, journal);
          const evidence = await gateway.executeFixture({ run_id: journal.run_id, fixture_id: fixture.fixture_id, attempt_id: attempt.attempt_id, deadline_ms: 12000 });
          const validated = validateProviderEvidence(evidence, fixture, journal.run_id);
          attempt.state = "completed"; attempt.completed_at = new Date(now()).toISOString(); attempt.evidence = validated; record.state = "completed";
          journal.updated_at = new Date(now()).toISOString(); writeJournal(journalPath, journal); onProgress(summarize(journal, accepted.control));
        } catch (error) { firstError ??= error; }
      }
    };
    await Promise.all([worker(), worker()]);
    if (firstError) throw firstError;
    journal.state = "completed";
  } catch (error) { original = error; if (journal.state === "running") journal.state = "stopped"; }
  finally {
    try { await gateway.disable(journal.run_id); } catch {}
    journal.provider_disabled_verified = isDisabled(await gateway.status().catch(() => null));
    journal.updated_at = new Date(now()).toISOString(); writeJournal(journalPath, journal);
  }
  if (!journal.provider_disabled_verified) stop(STOP.disable);
  if (original) throw original;
  const summary = summarize(journal, accepted.control);
  if (summary.completed !== 80) stop(STOP.journal);
  return { journal, summary, export: createRedactedExport(journal, accepted.control) };
}

export function requestKill(journalPath, registry, now = Date.now()) {
  const journal = readJournal(journalPath, registry);
  journal.kill_requested = true; journal.updated_at = new Date(now).toISOString(); writeJournal(journalPath, journal);
  return { status: "KILL_REQUEST_RECORDED", run_id: journal.run_id, next_action: "The controller will stop new dispatches, disable in finally, and verify disabled." };
}

export function createRedactedExport(journal, control) {
  const summary = summarize(journal, control);
  const value = {
    schema: "s2_t294_dice_technical_redacted_review_v1",
    evidence_class: "local_zero_network_rehearsal_only",
    live_azure_proof: false,
    run_id: journal.run_id,
    status: journal.state,
    summary,
    rows: journal.records.map((record) => {
      const evidence = record.attempts.findLast((attempt) => attempt.state === "completed")?.evidence;
      const attempts = evidence?.attempt_count ?? (record.attempts.some((attempt) => attempt.state === "dispatched") ? 2 : 0);
      return { fixture_id: record.fixture_id, language: record.language, disposition: evidence?.result_class ?? "not_run", latency_bucket: evidence ? (evidence.duration_ms < 1000 ? "under_1s" : "1_to_12s") : "not_run", attempts, input_token_bucket: evidence ? (evidence.input_tokens <= 400 ? "0_400" : "401_800") : "not_run", output_token_bucket: evidence ? (evidence.output_tokens === 0 ? "0" : evidence.output_tokens <= 150 ? "1_150" : "151_300") : "not_run", ratings: { authority: null, relevance: null, tone: null, language_quality: null, safety: null } };
    }),
  };
  const text = JSON.stringify(value).toLowerCase();
  if (FORBIDDEN.some((term) => text.includes(term)) || value.rows.length !== 80 || summary.cost_usd > 0.128) stop(STOP.export);
  return value;
}

export function exportSha(value) { return hash(`${JSON.stringify(value, null, 2)}\n`); }
