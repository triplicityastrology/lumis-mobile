// Founder free-text, multi-turn Companion conversation handler (server-side).
//
// The MAIN Lab experience: natural conversational messages (questions, statements, feelings,
// follow-ups, short replies, topic changes) with a bounded rolling context held by the browser.
// The server holds NO conversation state and never persists/logs raw conversation text.
//
// Reuses the existing routing/persona/Chart Composition/safety/response workflow (handleLabTurn +
// planLabTurn + persona-prompt-pipeline) and the existing Azure adapter controls (runGenerative:
// 12s deadline, one retry, 300-token output, post-safety). Provider access is gated by the
// executable-identity authorization + LUMIS_AI_ENABLED kill switch (authorizeProvider).

import { handleLabTurn, type LabGenerativeOutcome, type LabTurnContext, type LabTurnResult } from "./lab-turn.ts";
import { validateLabRequest, type CanonicalState, type LabPlan, type LabRequest } from "./lab-engine.ts";
import { serializePersonaPrompt, runGenerative } from "./lab-provider.ts";
import { authorizeProvider, type VerifiedIdentity } from "./lab-identity.ts";
import type { LabLanguage } from "./lab-constants.ts";

export const CONVERSATION_REQUEST_SCHEMA = "companion_web_ai_lab_request_v1" as const;

// Concise product-level classification (no chain-of-thought).
export type ProductClass = "safe_to_proceed" | "crisis_safety" | "out_of_scope" | "professional_boundary" | "horoscope_request" | "unavailable";
export function productClassification(state: CanonicalState): { class: ProductClass; label: string } {
  switch (state) {
    case "casual": case "knowledge": case "astro_deep": case "dice_handoff":
      return { class: "safe_to_proceed", label: "Safe to proceed" };
    case "crisis_imminent": case "distress_safety_check": case "illegal_boundary":
      return { class: "crisis_safety", label: "Crisis / safety" };
    case "professional_direct":
      return { class: "professional_boundary", label: "Professional boundary" };
    case "out_of_scope": case "out_of_scope_solar_return":
      return { class: "out_of_scope", label: "Out of scope" };
    case "astro_timing_handoff":
      return { class: "horoscope_request", label: "Horoscope / timing request" };
    default:
      return { class: "unavailable", label: "Unavailable" };
  }
}

export type ConversationContext = Readonly<{
  environment: Readonly<Record<string, string | undefined>>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  recordTelemetry?: LabTurnContext["recordTelemetry"];
  verifyIdentity?: () => VerifiedIdentity; // tests only; the server uses the real git check
}>;

export async function handleConversationTurn(raw: unknown, ctx: ConversationContext): Promise<LabTurnResult> {
  const nowMs = ctx.nowMs ?? Date.now;
  const fetchImpl = ctx.fetchImpl ?? fetch;

  // Authorize provider access (kill switch -> executable identity -> Azure config) BEFORE any key use.
  const auth = authorizeProvider(ctx.environment, fetchImpl, nowMs, { verifyIdentity: ctx.verifyIdentity });

  // liveProvider is wired ONLY when fully authorized; otherwise the turn is deterministic
  // (routing/classification/Chart Composition/fixed safety copy) with zero provider calls.
  const liveProvider = auth.ok
    ? async (args: { plan: LabPlan; request: LabRequest; language: LabLanguage }): Promise<LabGenerativeOutcome> => {
        const promptInput = serializePersonaPrompt(args.plan.personaPromptPayload, args.request.message, args.language, args.request.context);
        const outcome = await runGenerative(auth.runtime, promptInput, args.language, nowMs);
        switch (outcome.kind) {
          case "completed": return { kind: "completed", message: outcome.message, attempts: outcome.attempts };
          case "safety_rejected": return { kind: "safety_rejected", attempts: outcome.attempts, code: outcome.code };
          case "fixed_fallback": return { kind: "fixed_fallback", attempts: outcome.attempts, code: outcome.code };
          case "router_unavailable": return { kind: "router_unavailable", attempts: outcome.attempts, code: outcome.code };
          default: return { kind: "technical_error", attempts: outcome.attempts, code: outcome.code };
        }
      }
    : undefined;

  const turnCtx: LabTurnContext = { environment: ctx.environment, fetchImpl, nowMs, recordTelemetry: ctx.recordTelemetry, liveProvider };
  const out = await handleLabTurn(raw, turnCtx);

  // Augment with the product-level classification + authorization state (no secrets, no CoT).
  const body = out.body as Record<string, unknown>;
  if (typeof body.canonical_state === "string") {
    body.product_classification = productClassification(body.canonical_state as CanonicalState);
  }
  body.provider_authorized = auth.ok;
  body.provider_authorization_reason = auth.ok ? null : auth.code;
  return { status: out.status, body: body as LabTurnResult["body"] };
}

// A small helper the server uses to decide whether the multi-turn free-text path is even accepted.
export function conversationRequestKeysOk(raw: unknown): boolean {
  return validateLabRequest(raw).ok;
}
