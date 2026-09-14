/**
 * Dice v5 three-stage composition (Stage 1 + Stage 2 + Stage 3).
 *
 * Thin orchestrator that runs the UNCHANGED two-stage astrology window
 * (`executeDiceV05FreeTextCase`) and, only on a completed canonical result,
 * runs the Stage-3 customer-language editor (`executeDiceV05CustomerCopy`).
 * The astrology core (dice-v0-5-window.ts / -interpretation-contract.ts /
 * -presentation.ts) is not touched here, so this composition — and the Stage-3
 * module — cherry-picks cleanly onto a later WHERE-corrected base.
 *
 * A non-completed outcome (route-review / safety / fallback / bundled) passes
 * through unchanged and carries no customer copy.
 *
 * ONE end-to-end budget (C03): the composition captures a single absolute deadline
 * (`startedAt + SHARED_DEADLINE_MS`) and shares it with Stage 3 — Stage 3 does NOT get a
 * fresh second window. If Stage 1+2 consume the budget, Stage 3 makes zero provider calls
 * and the composition returns the validated fallback / controlled copy-unavailable outcome.
 * A Stage-3 retry runs against the same absolute deadline; it never resets it. This is a
 * conservative correction to the previous mismatch, not a claim that 12 s is sufficient for
 * good three-stage performance; a different coordinated budget may be approved after later
 * timing tests.
 */
import {
  executeDiceV05FreeTextCase, SHARED_DEADLINE_MS,
  type DiceV05FreeTextRequest, type DiceV05CaseOutcome, type DiceV05ProviderAdapter,
} from "./dice-v0-5-window.ts";
import {
  executeDiceV05CustomerCopy, CUSTOMER_COPY_UNAVAILABLE_MESSAGE,
  type DiceV05CustomerCopy,
} from "./dice-v0-5-customer-copy.ts";
import type { DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";

export type DiceV05ThreeStageOutcome =
  | Readonly<{
      kind: "completed";
      question_mode: DiceV05Mode;
      result: Record<string, unknown>;
      // The validated customer copy, or null when copy is unavailable (fixed message shown instead).
      customer_copy: DiceV05CustomerCopy | null;
      copy_source: "stage3" | "fallback" | "unavailable";
      copy_unavailable_message: string | null;
      copy_failure_code: string | null;
      provider_calls: number;            // Stage 1 + Stage 2 + Stage 3 (actual)
      astrology_provider_calls: number;  // Stage 1 + Stage 2 only
      metadata: Record<string, unknown>;
    }>
  | Exclude<DiceV05CaseOutcome, { kind: "completed" }>;

/** Run the full three-stage flow under ONE absolute end-to-end deadline. */
export async function executeDiceV05FreeTextCaseWithCopy(
  input: DiceV05FreeTextRequest,
  adapterSource: DiceV05ProviderAdapter | (() => DiceV05ProviderAdapter),
  now: () => number = () => Date.now(),
): Promise<DiceV05ThreeStageOutcome> {
  // One absolute deadline for the whole request; the two-stage window captures the same value
  // at its own start (called immediately below), and Stage 3 is handed this exact deadline.
  const deadlineAtMs = now() + SHARED_DEADLINE_MS;
  const canonical = await executeDiceV05FreeTextCase(input, adapterSource, now);
  if (canonical.kind !== "completed") return canonical;

  const copy = await executeDiceV05CustomerCopy(canonical.result, input.question, adapterSource, {
    now, deadlineAtMs,
  });

  const astrologyCalls = canonical.provider_calls;         // Stage 1 + Stage 2
  const copyCalls = copy.provider_calls;                   // Stage 3 (0, 1 or 2)
  const totalCalls = astrologyCalls + copyCalls;
  const unavailableMessage = copy.source === "unavailable"
    ? CUSTOMER_COPY_UNAVAILABLE_MESSAGE[canonical.result.language as "en" | "zh-Hant"]
    : null;

  return Object.freeze({
    kind: "completed",
    question_mode: canonical.question_mode,
    result: canonical.result,
    customer_copy: copy.copy,
    copy_source: copy.source,
    copy_unavailable_message: unavailableMessage,
    copy_failure_code: copy.failure_code,
    astrology_provider_calls: astrologyCalls,
    provider_calls: totalCalls,
    // metadata.provider_calls is the ACTUAL total across all three stages (C04); the separate
    // astrology-only and copy-only counts travel alongside it under unambiguous keys, and
    // copy_source travels here so the presentation layer never has to guess it. Units/persistence
    // stay 0 (charging untouched); provider calls are not customer charges.
    metadata: {
      ...canonical.metadata,
      provider_calls: totalCalls,
      astrology_provider_calls: astrologyCalls,
      copy_provider_calls: copyCalls,
      copy_source: copy.source,
    },
  }) as DiceV05ThreeStageOutcome;
}
