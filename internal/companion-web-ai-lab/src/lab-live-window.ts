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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  validateFounderChatWindowAuthority,
} from "../../../supabase/functions/_shared/founder-chat-window-v1.ts";

import { getLiveFixture, computeRegistryChecksum, liveLanguageCounts, LIVE_FIXTURE_COUNT } from "./lab-live-registry.ts";
import { handleLabTurn, type LabGenerativeOutcome, type LabTelemetry } from "./lab-turn.ts";
import { LAB_REQUEST_SCHEMA } from "./lab-constants.ts";

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
  });
  return createHash("sha256").update(canonical).digest("hex");
}
export function windowId(): string {
  return createHash("sha256")
    .update([LIVE_WINDOW_SCOPE, LIVE_WINDOW_PACKET_SHA, LIVE_WINDOW_AUTHORIZED_COMMIT, registryChecksum()].join("|"))
    .digest("hex").slice(0, 32);
}

// Build + validate the window authorization against the reused Founder authority contract.
export function buildAndValidateAuthorization(nowMs: number): Record<string, unknown> {
  const auth = {
    schema: "lumis_founder_chat_synthetic_window_authorization_v1",
    decision: "AUTHORIZED",
    scope: LIVE_WINDOW_SCOPE,
    accepted_dice_evidence_sha256: ACCEPTED_DICE_TECHNICAL_80_RECEIPT_SHA256,
    review_package_sha256: LIVE_WINDOW_PACKET_SHA,
    fixture_ids: [...FOUNDER_CHAT_FIXTURE_IDS],
    caps: {
      logical: 12, en: 6, zh_hant: 6, attempts: 24, concurrency: 1,
      deadline_ms: 12_000, retries: 1, input_tokens: 1200, output_tokens: 300,
    },
    issued_at: new Date(nowMs).toISOString(),
    valid_until: new Date(nowMs + LIVE_CAPS.windowMs).toISOString(),
    normal_chat_integration_authorized: false,
    member_traffic_authorized: false,
    persistence_authorized: false,
    units_authorized: false,
  };
  validateFounderChatWindowAuthority(auth, nowMs, LIVE_WINDOW_PACKET_SHA); // throws if non-conforming
  return auth;
}

// ---- Durable, content-free single-use ledger ----
type Ledger = {
  windowId: string; scope: string; packageSha: string; authorizedCommit: string;
  openedAt: number; disabled: boolean; disableReason: string | null;
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
    if (parsed && parsed.windowId === windowId() && parsed.scope === LIVE_WINDOW_SCOPE) return parsed;
    return null; // different window/packet -> ignore (a fresh window will open)
  } catch { return null; }
}

function persist(l: Ledger): void {
  const p = ledgerPath();
  const dir = p.slice(0, p.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(l));
}

function freshLedger(nowMs: number): Ledger {
  return {
    windowId: windowId(), scope: LIVE_WINDOW_SCOPE, packageSha: LIVE_WINDOW_PACKET_SHA, authorizedCommit: LIVE_WINDOW_AUTHORIZED_COMMIT,
    openedAt: nowMs, disabled: false, disableReason: null, logical: 0, en: 0, zhHant: 0, attempts: 0, consumed: [],
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
  const l = loadLedger();
  const opened = Boolean(l);
  const expired = l ? nowMs - l.openedAt > LIVE_CAPS.windowMs : false;
  return {
    scope: LIVE_WINDOW_SCOPE,
    window_id: windowId(),
    authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT,
    authorized_packet_sha: LIVE_WINDOW_PACKET_SHA,
    registry_checksum: registryChecksum(),
    package_checksum: packageChecksum(),
    fixture_count: LIVE_FIXTURE_COUNT,
    language_counts: liveLanguageCounts(),
    caps: LIVE_CAPS,
    opened,
    disabled: l ? l.disabled || expired : false,
    disable_reason: l ? (l.disabled ? l.disableReason : (expired ? "EXPIRED" : null)) : null,
    used: l ? { logical: l.logical, en: l.en, zhHant: l.zhHant, attempts: l.attempts } : { logical: 0, en: 0, zhHant: 0, attempts: 0 },
    remaining: l ? { logical: 12 - l.logical, en: 6 - l.en, zhHant: 6 - l.zhHant, attempts: 24 - l.attempts } : { logical: 12, en: 6, zhHant: 6, attempts: 24 },
    expires_in_ms: l ? Math.max(0, LIVE_CAPS.windowMs - (nowMs - l.openedAt)) : LIVE_CAPS.windowMs,
  };
}

function receipt(l: Ledger, nowMs: number, outcome: string) {
  return {
    scope: LIVE_WINDOW_SCOPE, window_id: l.windowId, authorized_packet_sha: LIVE_WINDOW_PACKET_SHA,
    authorized_commit: LIVE_WINDOW_AUTHORIZED_COMMIT, registry_checksum: registryChecksum(), package_checksum: packageChecksum(),
    outcome, disabled: l.disabled, disable_reason: l.disableReason,
    used: { logical: l.logical, en: l.en, zhHant: l.zhHant, attempts: l.attempts },
    remaining: { logical: 12 - l.logical, en: 6 - l.en, zhHant: 6 - l.zhHant, attempts: 24 - l.attempts },
    expires_in_ms: Math.max(0, LIVE_CAPS.windowMs - (nowMs - l.openedAt)),
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

export async function handleLiveFixtureTurn(raw: unknown, ctx: LiveTurnContext): Promise<LiveTurnResult> {
  const nowMs = ctx.nowMs ?? Date.now;
  const parsed = parseLiveRequest(raw);
  if (!parsed.ok) return reject(400, parsed.code, null, nowMs());

  // Provider must be configured server-side; otherwise DO NOT open/consume the window.
  const providerConfig = readChatAzureServerConfig(ctx.environment);
  if (!providerConfig.ok) return reject(503, `LAB_LIVE_PROVIDER_UNAVAILABLE:${providerConfig.code}`, null, nowMs());

  return runExclusive<LiveTurnResult>(async () => {
    const now = nowMs();
    let ledger = loadLedger();
    if (!ledger) { buildAndValidateAuthorization(now); ledger = freshLedger(now); persist(ledger); }

    if (ledger.disabled) return reject(409, `LAB_LIVE_WINDOW_DISABLED:${ledger.disableReason}`, ledger, now);
    if (now - ledger.openedAt > LIVE_CAPS.windowMs) { disable(ledger, "EXPIRED"); persist(ledger); return reject(410, "LAB_LIVE_WINDOW_EXPIRED", ledger, now); }

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
  });
}
