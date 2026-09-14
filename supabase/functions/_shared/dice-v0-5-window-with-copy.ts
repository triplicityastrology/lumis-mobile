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
 * through unchanged and carries no customer copy. Stage 3 runs on its own
 * provisional deadline budget; the combined three-call end-to-end deadline is a
 * pending §16 measurement/Founder decision and the window's 12s shared deadline
 * is intentionally left unchanged.
 */
import {
  executeDiceV05FreeTextCase,
  type DiceV05FreeTextRequest, type DiceV05CaseOutcome, type DiceV05ProviderAdapter,
} from "./dice-v0-5-window.ts";
import { executeDiceV05CustomerCopy, type DiceV05CustomerCopy } from "./dice-v0-5-customer-copy.ts";
import type { DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";

// Provisional Stage-3 budget. NOT added to the window's 12s shared deadline; the
// real end-to-end deadline policy is a pending §16 measurement (do not silently raise).
export const STAGE3_DEADLINE_MS = 12000 as const;

export type DiceV05ThreeStageOutcome =
  | Readonly<{
      kind: "completed";
      question_mode: DiceV05Mode;
      result: Record<string, unknown>;
      customer_copy: DiceV05CustomerCopy;
      copy_source: "stage3" | "fallback";
      copy_failure_code: string | null;
      provider_calls: number;       // Stage 1 + Stage 2 + Stage 3
      astrology_provider_calls: number; // Stage 1 + Stage 2 only
      metadata: Record<string, unknown>;
    }>
  | Exclude<DiceV05CaseOutcome, { kind: "completed" }>;

/** Run the full three-stage flow. Stage 3 uses the same injected adapter. */
export async function executeDiceV05FreeTextCaseWithCopy(
  input: DiceV05FreeTextRequest,
  adapterSource: DiceV05ProviderAdapter | (() => DiceV05ProviderAdapter),
  now: () => number = () => Date.now(),
): Promise<DiceV05ThreeStageOutcome> {
  const canonical = await executeDiceV05FreeTextCase(input, adapterSource, now);
  if (canonical.kind !== "completed") return canonical;

  const copy = await executeDiceV05CustomerCopy(canonical.result, input.question, adapterSource, {
    now, deadlineAtMs: now() + STAGE3_DEADLINE_MS,
  });

  return Object.freeze({
    kind: "completed",
    question_mode: canonical.question_mode,
    result: canonical.result,
    customer_copy: copy.copy,
    copy_source: copy.source,
    copy_failure_code: copy.failure_code,
    astrology_provider_calls: canonical.provider_calls,
    provider_calls: canonical.provider_calls + copy.provider_calls,
    // Canonical metadata is preserved unchanged; units/persistence stay 0 (charging untouched).
    metadata: { ...canonical.metadata, copy_source: copy.source, copy_provider_calls: copy.provider_calls },
  }) as DiceV05ThreeStageOutcome;
}
