// Optional Regression panel: the 12 frozen synthetic fixtures (6 EN / 6 zh-Hant).
//
// Separate from the main free-text Companion experience: NOT the main flow, NOT a limit on Founder
// conversation testing, NOT required before free-text. Each fixture runs on demand through the
// reused ChatSyntheticRun gateway (companion-synthetic prompt) under the SAME executable-identity +
// kill-switch authorization as the free-text path. No window, no ledger, no single-use, no 900s.

import {
  ChatSyntheticRun, type ChatSyntheticResponse, type ChatSyntheticAdapter,
} from "../../../supabase/functions/_shared/chat-synthetic-gateway-v1.ts";
import { handleLabTurn, type LabGenerativeOutcome, type LabTurnResult, type LabTelemetry } from "./lab-turn.ts";
import { authorizeProvider, type VerifiedIdentity } from "./lab-identity.ts";
import { getLiveFixture, listLiveFixturesForUi } from "./lab-live-registry.ts";
import { productClassification } from "./lab-conversation.ts";
import { LAB_REQUEST_SCHEMA } from "./lab-constants.ts";
import type { CanonicalState } from "./lab-engine.ts";

export const REGRESSION_REQUEST_SCHEMA = "companion_web_ai_lab_regression_request_v1" as const;

export type RegressionContext = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  recordTelemetry?: (t: LabTelemetry) => void;
  verifyIdentity?: () => VerifiedIdentity; // tests only
}>;

export function listRegressionFixtures() { return listLiveFixturesForUi(); }

function parse(raw: unknown): { ok: true; fixtureId: string } | { ok: false; code: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "LAB_REGRESSION_REQUEST_INVALID" };
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== 2 || !keys.every((k) => k === "schema_version" || k === "fixture_id")) return { ok: false, code: "LAB_REGRESSION_REQUEST_UNKNOWN_FIELD" };
  if (r.schema_version !== REGRESSION_REQUEST_SCHEMA) return { ok: false, code: "LAB_REGRESSION_SCHEMA_UNKNOWN" };
  if (typeof r.fixture_id !== "string") return { ok: false, code: "LAB_REGRESSION_FIXTURE_ID_INVALID" };
  return { ok: true, fixtureId: r.fixture_id };
}

function mapGateway(gw: ChatSyntheticResponse): LabGenerativeOutcome {
  const attempts = gw.provider_attempts;
  switch (gw.result) {
    case "completed": return { kind: "completed", message: gw.assistant_message ?? "", attempts };
    case "safety_rejected": return { kind: "safety_rejected", attempts, code: gw.error_code ?? "GATEWAY_SAFETY" };
    case "fixed_fallback": return { kind: "fixed_fallback", attempts, code: gw.error_code ?? "GATEWAY_FALLBACK" };
    default: return { kind: "technical_error", attempts, code: gw.error_code ?? "GATEWAY_TECHNICAL" };
  }
}

const randHex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export async function handleRegressionFixture(raw: unknown, ctx: RegressionContext): Promise<LabTurnResult> {
  const nowMs = ctx.nowMs ?? Date.now;
  const fetchImpl = ctx.fetchImpl ?? fetch;

  const parsed = parse(raw);
  if (!parsed.ok) return { status: 400, body: rejectBody(parsed.code, false) };
  const fixture = getLiveFixture(parsed.fixtureId);
  if (!fixture) return { status: 400, body: rejectBody("LAB_REGRESSION_FIXTURE_NOT_ALLOWED", true) };

  const auth = authorizeProvider(ctx.environment, fetchImpl, nowMs, { verifyIdentity: ctx.verifyIdentity });

  const liveProvider = auth.ok
    ? async (): Promise<LabGenerativeOutcome> => {
        const gateway = new ChatSyntheticRun({
          aiEnabled: true, adapter: auth.runtime.adapter as ChatSyntheticAdapter, nowMs,
          recordMetadata: (event) => { if (ctx.recordTelemetry) ctx.recordTelemetry({ requestId: `reg-${event.runId}`, timestamp: new Date(nowMs()).toISOString(), baseRoute: null, canonicalState: "regression_fixture", result: event.result, language: event.language, providerAttempts: event.attemptCount, durationBucket: event.durationBucket, errorCode: event.failureCode, templateId: null, aiEnabled: true }); },
        });
        const gw = await gateway.handle({ fixture_id: fixture.id, idempotency_key: `reg${randHex(24)}`, run_id: `chat-syn-${randHex(16)}` });
        return mapGateway(gw);
      }
    : undefined;

  const request = {
    schema_version: LAB_REQUEST_SCHEMA,
    role_code: fixture.roleCode,
    chart: fixture.chart,
    message: fixture.serverPromptInput,
    app_language_preference: fixture.language,
    context: [],
  };

  const out = await handleLabTurn(request, { environment: ctx.environment, fetchImpl, nowMs, recordTelemetry: ctx.recordTelemetry, liveProvider });
  const body = out.body as Record<string, unknown>;
  if (typeof body.canonical_state === "string") body.product_classification = productClassification(body.canonical_state as CanonicalState);
  body.regression = true;
  body.regression_fixture_id = fixture.id;
  body.regression_language = fixture.language;
  body.provider_authorized = auth.ok;
  body.provider_authorization_reason = auth.ok ? null : auth.code;
  return { status: out.status, body: body as LabTurnResult["body"] };
}

function rejectBody(code: string, authorizedShape: boolean): LabTurnResult["body"] {
  return {
    schema_version: "companion_web_ai_lab_response_v1", not_signed_off_customer_ui: true,
    canonical_state: "technical_error", result: "technical_error", error_code: code,
    persistence: "not_committed", units_charged: 0, idempotency_outcome: "not_committed", provider_attempts: 0,
    provider_authorized: authorizedShape,
  } as unknown as LabTurnResult["body"];
}
