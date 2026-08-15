// Authorized LIVE 12-case synthetic Chat window (server-side only).
//
// Enforces the Founder-authorized packet server-side so that:
//   - live AI runs only for the closed 12 fixtures (6 EN / 6 zh-Hant); arbitrary browser text
//     can never reach Azure (the browser submits only fixture_id);
//   - the packet limits hold via an ATOMIC, durable, single-use ledger that survives browser
//     refresh, server restart, replay and concurrent requests.
//
// Reuses the T350 authority + gateway directly:
//   - validateFounderChatWindowAuthority + FOUNDER_CHAT_FIXTURE_IDS + ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256
//   - ChatSyntheticRun gateway (caps: input 1200 / output 300 / concurrency 1 / deadline 12s /
//     one retry / units 0 / not_committed / safety-before-prompt)
//   - createAzureChatSyntheticAdapter + readChatAzureServerConfig (server-side Azure identity/key)

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  ChatSyntheticRun,
  type ChatSyntheticResponse,
  type ChatSyntheticAdapter,
  type ProviderResult,
} from "../../../supabase/functions/_shared/chat-synthetic-gateway-v1.ts";
import {
  createAzureChatSyntheticAdapter,
  readChatAzureServerConfig,
} from "../../../supabase/functions/_shared/azure-chat-synthetic-adapter-v1.ts";
import {
  FOUNDER_CHAT_FIXTURE_IDS,
  ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256,
} from "../../../supabase/functions/_shared/founder-chat-window-v1.ts";

import { getLiveFixture, computeRegistryChecksum, liveLanguageCounts, LIVE_FIXTURE_COUNT } from "./lab-live-registry.ts";
import { handleLabTurn, type LabGenerativeOutcome, type LabTelemetry } from "./lab-turn.ts";
import { LAB_REQUEST_SCHEMA } from "./lab-constants.ts";
import {
  loadReceipt, readSeal, writeSeal, mintReceipt,
  type ReceiptExpected, type AuthorizationReceipt, type VerifiedReceipt,
} from "./lab-live-receipt.ts";

// The continuation lineage anchor the receipt binds to (Technical's compatibility base commit).
export const LIVE_WINDOW_CONTINUATION_COMMIT = "4862809e6946b79b5abe1dbaa870d3ed4292971a" as const;

// ---- Packet (Founder-authorized; carried forward from commit 93e578f) ----
export const LIVE_WINDOW_SCOPE = "FOUNDER_CHAT_SYNTHETIC_WINDOW_12_ONLY" as const;
export const LIVE_WINDOW_AUTHORIZED_COMMIT = "93e578fe7ba7438734c4e79c4e629bf1393b73c8" as const;
export const LIVE_WINDOW_PACKET_SHA = "05b7a182de81f8de64d0c91475b24568d4470fd13ff716f16f372acb3e6e19b0" as const;
export const LIVE_WINDOW_REQUEST_SCHEMA = "companion_web_ai_lab_live_request_v1" as const;

export const LIVE_CAPS = Object.freeze({
  logical: 12, en: 6, zhHant: 6, attempts: 24, concurrency: 1,
  deadlineMs: 12_000, retries: 1, inputTokens: 1200, outputTokens: 300, windowMs: 900_000,
});

// ---- Deterministic checksums (item 8) ----
export function registryChecksum(): string { return computeRegistryChecksum(); }
export function packageChecksum(): string {
  const canonical = JSON.stringify({
    scope: LIVE_WINDOW_SCOPE,
    authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT,
    authorized_packet_sha: LIVE_WINDOW_PACKET_SHA,
    caps: {
      logical: LIVE_CAPS.logical, en: LIVE_CAPS.en, zh_hant: LIVE_CAPS.zhHant, attempts: LIVE_CAPS.attempts,
      concurrency: LIVE_CAPS.concurrency, deadline_ms: LIVE_CAPS.deadlineMs, retries: LIVE_CAPS.retries,
      input_tokens: LIVE_CAPS.inputTokens, output_tokens: LIVE_CAPS.outputTokens, window_ms: LIVE_CAPS.windowMs,
    },
    fixture_ids: [...FOUNDER_CHAT_FIXTURE_IDS],
    registry_checksum: registryChecksum(),
    ledger_protocol: "atomic_file_lock_v2",
    authorization: "immutable_receipt_v1",
  });
  return createHash("sha256").update(canonical).digest("hex");
}
export function windowId(): string {
  return createHash("sha256")
    .update([LIVE_WINDOW_SCOPE, LIVE_WINDOW_PACKET_SHA, LIVE_WINDOW_AUTHORIZED_COMMIT, registryChecksum()].join("|"))
    .digest("hex").slice(0, 32);
}

// Expected receipt identity bindings (deterministic). The server verifies a loaded receipt against
// these; it never mints or refreshes an authorization from the current clock.
export function authorizationExpected(): ReceiptExpected {
  return {
    scope: LIVE_WINDOW_SCOPE,
    packetSha: LIVE_WINDOW_PACKET_SHA,
    diceSha: ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256,
    registryChecksum: registryChecksum(),
    packageChecksum: packageChecksum(),
    continuationCommit: LIVE_WINDOW_CONTINUATION_COMMIT,
    fixtureIds: [...FOUNDER_CHAT_FIXTURE_IDS],
    caps: { logical: 12, en: 6, zh_hant: 6, attempts: 24, concurrency: 1, deadline_ms: 12_000, retries: 1, input_tokens: 1200, output_tokens: 300 },
  };
}

// OPERATOR / TEST ONLY: mint an immutable receipt for a fixed window [issuedAtMs, validUntilMs].
// The server request path NEVER calls this — it only loads and verifies a pre-existing receipt file.
export function mintLocalReceipt(issuedAtMs: number, validUntilMs: number): AuthorizationReceipt {
  return mintReceipt(authorizationExpected(), issuedAtMs, validUntilMs);
}

// ---- Durable, content-free single-use ledger ----
type Ledger = {
  windowId: string; scope: string; packageSha: string; authorizedCommit: string;
  openedAt: number; validUntil: number; disabled: boolean; disableReason: string | null;
  logical: number; en: number; zhHant: number; attempts: number; consumed: string[];
};

function ledgerPath(): string {
  const configured = (process.env.LAB_LIVE_LEDGER_PATH ?? "").trim();
  return configured || `${process.cwd()}/.tmp/lab-live-window-ledger.json`;
}

function loadLedger(): Ledger | null {
  const p = ledgerPath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Ledger;
    if (validLedger(parsed)) return parsed;
  } catch { /* fail closed below */ }
  throw new Error("LAB_LIVE_LEDGER_INVALID");
}

function persist(l: Ledger): void {
  const p = ledgerPath();
  const dir = p.slice(0, p.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${p}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, JSON.stringify(l), { flag: "wx", mode: 0o600 });
    renameSync(temporary, p);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}

function validLedger(value: unknown): value is Ledger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ledger = value as Record<string, unknown>;
  const keys = ["windowId", "scope", "packageSha", "authorizedCommit", "openedAt", "validUntil", "disabled", "disableReason", "logical", "en", "zhHant", "attempts", "consumed"];
  if (Object.keys(ledger).length !== keys.length || Object.keys(ledger).some((key) => !keys.includes(key))) return false;
  if (ledger.windowId !== windowId() || ledger.scope !== LIVE_WINDOW_SCOPE || ledger.packageSha !== LIVE_WINDOW_PACKET_SHA || ledger.authorizedCommit !== LIVE_WINDOW_AUTHORIZED_COMMIT ||
      !Number.isFinite(ledger.openedAt) || !Number.isFinite(ledger.validUntil) || typeof ledger.disabled !== "boolean" || !(ledger.disableReason === null || typeof ledger.disableReason === "string") ||
      !Number.isInteger(ledger.logical) || !Number.isInteger(ledger.en) || !Number.isInteger(ledger.zhHant) || !Number.isInteger(ledger.attempts) || !Array.isArray(ledger.consumed)) return false;
  const consumed = ledger.consumed as unknown[];
  if (consumed.some((id) => typeof id !== "string" || !FOUNDER_CHAT_FIXTURE_IDS.includes(id as typeof FOUNDER_CHAT_FIXTURE_IDS[number])) || new Set(consumed).size !== consumed.length) return false;
  const en = consumed.filter((id) => getLiveFixture(String(id))?.language === "en").length;
  const zhHant = consumed.filter((id) => getLiveFixture(String(id))?.language === "zh-Hant").length;
  return ledger.logical === consumed.length && ledger.en === en && ledger.zhHant === zhHant &&
    ledger.logical >= 0 && ledger.logical <= LIVE_CAPS.logical && ledger.en >= 0 && ledger.en <= LIVE_CAPS.en && ledger.zhHant >= 0 && ledger.zhHant <= LIVE_CAPS.zhHant &&
    (ledger.attempts as number) >= 0 && (ledger.attempts as number) <= LIVE_CAPS.attempts;
}

function acquireLedgerLock(): () => void {
  const lock = `${ledgerPath()}.lock`;
  const dir = lock.slice(0, lock.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch { throw new Error("LAB_LIVE_LEDGER_BUSY"); }
  return () => rmSync(lock, { recursive: true, force: true });
}

function freshLedger(nowMs: number, validUntilMs: number): Ledger {
  return {
    windowId: windowId(), scope: LIVE_WINDOW_SCOPE, packageSha: LIVE_WINDOW_PACKET_SHA, authorizedCommit: LIVE_WINDOW_AUTHORIZED_COMMIT,
    openedAt: nowMs, validUntil: validUntilMs, disabled: false, disableReason: null, logical: 0, en: 0, zhHant: 0, attempts: 0, consumed: [],
  };
}

function disable(l: Ledger, reason: string): void {
  if (!l.disabled) { l.disabled = true; l.disableReason = reason; }
}

// Serialize live requests (concurrency 1) with a promise-chain mutex.
let mutex: Promise<unknown> = Promise.resolve();
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutex.then(fn, fn);
  mutex = run.then(() => undefined, () => undefined);
  return run;
}

// ---- Public status (content-free) ----
export function liveWindowStatus(nowMs: number) {
  let l: Ledger | null;
  try { l = loadLedger(); }
  catch {
    return {
      scope: LIVE_WINDOW_SCOPE, window_id: windowId(), authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT,
      authorized_packet_sha: LIVE_WINDOW_PACKET_SHA, registry_checksum: registryChecksum(), package_checksum: packageChecksum(),
      fixture_count: LIVE_FIXTURE_COUNT, language_counts: liveLanguageCounts(), caps: LIVE_CAPS,
      opened: true, disabled: true, disable_reason: "LEDGER_INVALID",
      used: { logical: 0, en: 0, zhHant: 0, attempts: 0 }, remaining: { logical: 0, en: 0, zhHant: 0, attempts: 0 }, expires_in_ms: 0,
    };
  }
  const opened = Boolean(l);
  const expired = l ? nowMs >= l.validUntil : false;
  // Best-effort receipt authorization state (content-free) for the UI/operators.
  let authorized = false;
  let authorizationReason: string | null = "LAB_LIVE_RECEIPT_NOT_VERIFIED";
  try { loadReceipt(nowMs, authorizationExpected()); authorized = true; authorizationReason = null; }
  catch (e) { authorizationReason = (e as Error).message; }
  return {
    scope: LIVE_WINDOW_SCOPE,
    window_id: windowId(),
    authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT,
    continuation_commit: LIVE_WINDOW_CONTINUATION_COMMIT,
    authorized_packet_sha: LIVE_WINDOW_PACKET_SHA,
    registry_checksum: registryChecksum(),
    package_checksum: packageChecksum(),
    receipt_authorized: authorized,
    authorization_reason: authorizationReason,
    fixture_count: LIVE_FIXTURE_COUNT,
    language_counts: liveLanguageCounts(),
    caps: LIVE_CAPS,
    opened,
    disabled: l ? l.disabled || expired : false,
    disable_reason: l ? (l.disabled ? l.disableReason : (expired ? "EXPIRED" : null)) : null,
    used: l ? { logical: l.logical, en: l.en, zhHant: l.zhHant, attempts: l.attempts } : { logical: 0, en: 0, zhHant: 0, attempts: 0 },
    remaining: l ? { logical: 12 - l.logical, en: 6 - l.en, zhHant: 6 - l.zhHant, attempts: 24 - l.attempts } : { logical: 12, en: 6, zhHant: 6, attempts: 24 },
    expires_in_ms: l ? Math.max(0, l.validUntil - nowMs) : 0,
  };
}

function receipt(l: Ledger, nowMs: number, outcome: string) {
  return {
    scope: LIVE_WINDOW_SCOPE, window_id: l.windowId, authorized_packet_sha: LIVE_WINDOW_PACKET_SHA,
    authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT, registry_checksum: registryChecksum(), package_checksum: packageChecksum(),
    outcome, disabled: l.disabled, disable_reason: l.disableReason,
    used: { logical: l.logical, en: l.en, zhHant: l.zhHant, attempts: l.attempts },
    remaining: { logical: 12 - l.logical, en: 6 - l.en, zhHant: 6 - l.zhHant, attempts: 24 - l.attempts },
    expires_in_ms: Math.max(0, l.validUntil - nowMs),
  };
}

export type LiveTurnContext = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  recordTelemetry?: (t: LabTelemetry) => void;
}>;

export type LiveTurnResult = { status: number; body: Record<string, unknown> };

function reject(status: number, code: string, l: Ledger | null, nowMs: number): LiveTurnResult {
  return {
    status,
    body: {
      schema_version: "companion_web_ai_lab_response_v1", not_signed_off_customer_ui: true,
      canonical_state: "route_unavailable", result: "route_unavailable", error_code: code,
      persistence: "not_committed", units_charged: 0, idempotency_outcome: "not_committed", provider_attempts: 0,
      live_receipt: l ? receipt(l, nowMs, code) : { scope: LIVE_WINDOW_SCOPE, window_id: windowId(), outcome: code, disabled: true },
    },
  };
}

function mapGatewayToOutcome(gw: ChatSyntheticResponse): LabGenerativeOutcome {
  const attempts = gw.provider_attempts;
  switch (gw.result) {
    case "completed": return { kind: "completed", message: gw.assistant_message ?? "", attempts };
    case "safety_rejected": return { kind: "safety_rejected", attempts, code: gw.error_code ?? "GATEWAY_SAFETY" };
    case "fixed_fallback": return { kind: "fixed_fallback", attempts, code: gw.error_code ?? "GATEWAY_FALLBACK" };
    default: return { kind: "technical_error", attempts, code: gw.error_code ?? "GATEWAY_TECHNICAL" };
  }
}

const randHex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

// Parse the closed live request: the browser may submit ONLY schema_version + fixture_id.
function parseLiveRequest(raw: unknown): { ok: true; fixtureId: string } | { ok: false; code: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "LAB_LIVE_REQUEST_INVALID" };
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== 2 || !keys.every((k) => k === "schema_version" || k === "fixture_id")) return { ok: false, code: "LAB_LIVE_REQUEST_UNKNOWN_FIELD" };
  if (r.schema_version !== LIVE_WINDOW_REQUEST_SCHEMA) return { ok: false, code: "LAB_LIVE_SCHEMA_UNKNOWN" };
  if (typeof r.fixture_id !== "string") return { ok: false, code: "LAB_LIVE_FIXTURE_ID_INVALID" };
  return { ok: true, fixtureId: r.fixture_id };
}

function receiptRejectStatus(code: string): number {
  if (code === "LAB_LIVE_RECEIPT_MISSING") return 503;
  if (code === "LAB_LIVE_RECEIPT_EXPIRED") return 410;
  return 409; // INVALID / CHECKSUM_MISMATCH / IDENTITY_MISMATCH
}

export async function handleLiveFixtureTurn(raw: unknown, ctx: LiveTurnContext): Promise<LiveTurnResult> {
  const nowMs = ctx.nowMs ?? Date.now;
  const parsed = parseLiveRequest(raw);
  if (!parsed.ok) return reject(400, parsed.code, null, nowMs());

  // (1) Load + verify the IMMUTABLE authorization receipt BEFORE any Azure key or client is accessed.
  //     The server never mints or refreshes a window from the current clock; the receipt's fixed
  //     issued_at / valid_until govern. Missing/altered/expired/identity-mismatched -> rejected here.
  const expected = authorizationExpected();
  let verified: VerifiedReceipt;
  try { verified = loadReceipt(nowMs(), expected); }
  catch (e) { const code = (e as Error).message; return reject(receiptRejectStatus(code), code, null, nowMs()); }

  // (2) Provider must be configured server-side; otherwise DO NOT open/consume the window.
  const providerConfig = readChatAzureServerConfig(ctx.environment);
  if (!providerConfig.ok) return reject(503, `LAB_LIVE_PROVIDER_UNAVAILABLE:${providerConfig.code}`, null, nowMs());

  return runExclusive<LiveTurnResult>(async () => {
    let release: (() => void) | null = null;
    try { release = acquireLedgerLock(); }
    catch { return reject(409, "LAB_LIVE_AUTHORITY_BUSY", null, nowMs()); }
    try {
    const now = nowMs();
    let ledger: Ledger | null;
    try { ledger = loadLedger(); }
    catch { return reject(409, "LAB_LIVE_LEDGER_INVALID", null, now); }

    // (3) Single-use activation bound to a receipt seal co-located with the immutable receipt.
    //     Deleting the working ledger after activation fails closed (no replay); a seal that does
    //     not match the current receipt is rejected. Restart keeps both files -> continues.
    let seal;
    try { seal = readSeal(); }
    catch { return reject(409, "LAB_LIVE_SEAL_INVALID", ledger, now); }
    if (!ledger) {
      if (seal) return reject(409, "LAB_LIVE_LEDGER_MISSING", null, now); // activated before; ledger deleted -> no replay
      writeSeal({ receiptChecksum: verified.receiptChecksum, windowId: windowId(), activatedAt: now });
      ledger = freshLedger(now, verified.validUntilMs); persist(ledger);
    } else if (!seal || seal.receiptChecksum !== verified.receiptChecksum || ledger.validUntil !== verified.validUntilMs) {
      return reject(409, "LAB_LIVE_RECEIPT_SEAL_MISMATCH", ledger, now);
    }

    if (ledger.disabled) return reject(409, `LAB_LIVE_WINDOW_DISABLED:${ledger.disableReason}`, ledger, now);
    if (now >= ledger.validUntil) { disable(ledger, "EXPIRED"); persist(ledger); return reject(410, "LAB_LIVE_WINDOW_EXPIRED", ledger, now); }

    const fixture = getLiveFixture(parsed.fixtureId);
    if (!fixture) return reject(400, "LAB_LIVE_FIXTURE_NOT_ALLOWED", ledger, now); // unknown fixture: before provider, no consumption
    if (ledger.consumed.includes(fixture.id)) {
      return { status: 200, body: { schema_version: "companion_web_ai_lab_response_v1", not_signed_off_customer_ui: true, canonical_state: "route_unavailable", result: "duplicate", error_code: "LAB_LIVE_FIXTURE_ALREADY_CONSUMED", persistence: "not_committed", units_charged: 0, idempotency_outcome: "not_committed", provider_attempts: 0, live_receipt: receipt(ledger, now, "REPLAY_REJECTED") } };
    }

    const langKey = fixture.language === "en" ? "en" : "zhHant";
    if (ledger.logical >= LIVE_CAPS.logical || ledger[langKey] >= (fixture.language === "en" ? LIVE_CAPS.en : LIVE_CAPS.zhHant)) {
      disable(ledger, "CAP_BREACH"); persist(ledger); return reject(429, "LAB_LIVE_CAP_BREACH", ledger, now);
    }

    // Atomic reservation BEFORE any provider contact.
    ledger.logical += 1; ledger[langKey] += 1; ledger.consumed.push(fixture.id); persist(ledger);

    try {
      const baseAdapter = createAzureChatSyntheticAdapter(providerConfig.config, ctx.fetchImpl ?? fetch, ctx.nowMs);
      // Attempt-counting adapter enforces the 24-attempt cap atomically (serialized by the mutex).
      const countingAdapter: ChatSyntheticAdapter = {
        async complete(input): Promise<ProviderResult> {
          if (ledger!.attempts >= LIVE_CAPS.attempts) { disable(ledger!, "ATTEMPT_CAP_BREACH"); persist(ledger!); return { kind: "forbidden" }; }
          ledger!.attempts += 1; persist(ledger!);
          return baseAdapter.complete(input);
        },
      };

      const liveProvider = async (): Promise<LabGenerativeOutcome> => {
        const gateway = new ChatSyntheticRun({
          aiEnabled: true, adapter: countingAdapter, nowMs: ctx.nowMs ?? Date.now,
          recordMetadata: (event) => { if (ctx.recordTelemetry) ctx.recordTelemetry({ requestId: `live-${event.runId}`, timestamp: new Date(now).toISOString(), baseRoute: null, canonicalState: "live_fixture", result: event.result, language: event.language, providerAttempts: event.attemptCount, durationBucket: event.durationBucket, errorCode: event.failureCode, templateId: null, aiEnabled: true }); },
        });
        const gw = await gateway.handle({ fixture_id: fixture.id, idempotency_key: `lab${randHex(24)}`, run_id: `chat-syn-${randHex(16)}` });
        return mapGatewayToOutcome(gw);
      };

      const request = {
        schema_version: LAB_REQUEST_SCHEMA,
        role_code: fixture.roleCode,
        chart: fixture.chart,
        message: fixture.serverPromptInput,
        app_language_preference: fixture.language,
      };

      const out = await handleLabTurn(request, { environment: {}, nowMs: ctx.nowMs, recordTelemetry: ctx.recordTelemetry, liveProvider });
      const body = { ...(out.body as Record<string, unknown>), live_fixture_id: fixture.id, live_receipt: receipt(ledger, now, "COMPLETED") };
      return { status: out.status, body };
    } catch {
      disable(ledger, "DEVIATION"); persist(ledger);
      return reject(500, "LAB_LIVE_DEVIATION", ledger, now);
    } finally {
      // Immediate disable on completion (single-use window done) / already-disabled deviations.
      if (ledger.logical >= LIVE_CAPS.logical && !ledger.disabled) disable(ledger, "COMPLETED");
      persist(ledger);
    }
    } finally { release(); }
  });
}
