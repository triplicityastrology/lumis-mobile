/**
 * Dice v5 three-stage composition (Stage 1 + Stage 2 + Stage 3).
 *
 * Runs the UNCHANGED two-stage astrology window (`executeDiceV05FreeTextCase`) and, on a
 * completed canonical result, produces the customer copy. The astrology core is not touched
 * here, so this composition — and the Stage-3 module — cherry-picks cleanly onto a later
 * WHERE-corrected base. A non-completed outcome passes through unchanged with no customer copy.
 *
 * ONE end-to-end deadline (D01/C03): the composition captures a single absolute deadline BEFORE
 * calling the window and passes that exact value into the window (so Stage 1 and Stage 2 use it,
 * not a fresh capture after preprocessing) and into Stage 3. There is no second window; if the
 * budget is spent, Stage 3 makes zero provider calls. Retries share the same absolute deadline.
 * 12 s budget and the 14 s transport margin are unchanged; a different coordinated budget is a
 * separate Founder/Architect decision.
 *
 * COPY MODE (S01/S02/S04/S05): the DEFAULT is "deterministic" — the displayed customer copy is
 * assembled entirely from the validated canonical result (warning, practical/search step,
 * follow-up sequence, timing band, judgment axes + synthesis, Location projection), so no provider
 * text can substitute a Location step, reorder follow-ups, negate a warning, drop synthesis, or
 * reverse a timing band / judgment orientation. The provider LANGUAGE editor ("provider" mode) is
 * gated OFF by default pending the deferred Founder live-language + semantic-fidelity acceptance
 * (L02–L04). When enabled it language-improves the customer-facing answer/explanation prose AND (RG2)
 * the controlled fields — the warning, the practical/search step and the follow-up questions —
 * through the structured, source-bound editor contract (see assembleEditorCopy), under source-relative
 * negation/polarity/order/place guards that catch the reproduced reversals (review C03–C07) but do NOT
 * prove full paraphrase fidelity (RG3 open). The Location AREA, ordered candidate LIST and search order
 * stay a canonical fact (never taken from the editor); the search STEP text is edited under the guards.
 * The editor_response is carried onto the wire in the FLAT contract (editorResponseToWire, review C02).
 */
import {
  executeDiceV05FreeTextCase, SHARED_DEADLINE_MS,
  type DiceV05FreeTextRequest, type DiceV05CaseOutcome, type DiceV05ProviderAdapter,
} from "./dice-v0-5-window.ts";
import {
  executeDiceV05CustomerCopy, buildValidatedFallback, CUSTOMER_COPY_UNAVAILABLE_MESSAGE,
  publicCopyFailure,
  type DiceV05CustomerCopy, type DiceV05EditorWire, type Landing,
} from "./dice-v0-5-customer-copy.ts";
import { runFidelityCheck, fidelityComponentsFromWire, type FidelityOutcomeWire } from "./dice-v0-5-copy-fidelity.ts";
import type { DiceV05Mode } from "./dice-v0-5-interpretation-contract.ts";
import type { DiceV05PlanetId, DiceV05SignId } from "./dice-v0-5-fixed-data.ts";

export type DiceV05CopyMode = "deterministic" | "provider";

export type DiceV05ThreeStageOutcome =
  | Readonly<{
      kind: "completed";
      question_mode: DiceV05Mode;
      result: Record<string, unknown>;
      // The validated customer copy, or null when copy is unavailable (fixed message shown instead).
      customer_copy: DiceV05CustomerCopy | null;
      // "deterministic": assembled from canonical (default). "stage3"/"fallback": provider mode.
      // "unavailable": no valid copy could be produced; the fixed message is shown.
      copy_source: "deterministic" | "stage3" | "fallback" | "unavailable";
      copy_unavailable_message: string | null;
      copy_failure_code: string | null;
      // The FLAT wire editor response behind a "stage3" copy (review C02/R05), so the Web boundary can
      // independently re-parse, re-assemble and re-validate it (defence in depth). Null otherwise.
      editor_response: DiceV05EditorWire | null;
      // The typed Stage-4 meaning-checker outcome behind an ACCEPTED stage3 copy (Founder Option 2),
      // carried so the Web can validate coverage + binding WITHOUT a second checker call. Null otherwise.
      checker_outcome: FidelityOutcomeWire | null;
      provider_calls: number;            // Stage 1 + Stage 2 + Stage 3 editor + Stage 4 checker (actual)
      astrology_provider_calls: number;  // Stage 1 + Stage 2 only
      editor_provider_calls: number;     // Stage 3 editor attempts (transported)
      checker_provider_calls: number;    // Stage 4 checker attempts (transported; at most 1)
      metadata: Record<string, unknown>;
    }>
  | Exclude<DiceV05CaseOutcome, { kind: "completed" }>;

/** Run the full flow under ONE absolute end-to-end deadline. Default copy is deterministic. */
export async function executeDiceV05FreeTextCaseWithCopy(
  input: DiceV05FreeTextRequest,
  adapterSource: DiceV05ProviderAdapter | (() => DiceV05ProviderAdapter),
  now: () => number = () => Date.now(),
  opts: Readonly<{ copyMode?: DiceV05CopyMode }> = {},
): Promise<DiceV05ThreeStageOutcome> {
  const copyMode: DiceV05CopyMode = opts.copyMode ?? "deterministic";
  // One absolute deadline for the whole request, captured before the window's preprocessing and
  // passed in unchanged (D01), then reused by Stage 3.
  const deadlineAtMs = now() + SHARED_DEADLINE_MS;
  const canonical = await executeDiceV05FreeTextCase(input, adapterSource, now, deadlineAtMs);
  if (canonical.kind !== "completed") return canonical;

  const astrologyCalls = canonical.provider_calls; // Stage 1 + Stage 2
  // The trusted physical landing from the validated request — used to derive the authoritative
  // combined pace (V04) and passed through to Stage 3.
  const landing: Landing = {
    planet: input.planet_id as DiceV05PlanetId,
    sign: input.sign_id as DiceV05SignId,
    house: Number(input.house_id.slice("house_".length)),
  };
  let customerCopy: DiceV05CustomerCopy | null;
  let copySource: "deterministic" | "stage3" | "fallback" | "unavailable";
  let copyFailure: string | null;
  let editorCalls = 0;
  let checkerCalls = 0;
  // Flat wire contract (review C02/R05): forwarded verbatim to the Web boundary for independent re-parse.
  let editorResponse: DiceV05EditorWire | null = null;
  let checkerOutcome: FidelityOutcomeWire | null = null;

  if (copyMode === "provider") {
    // Stage 3 — gated language editor.
    const copy = await executeDiceV05CustomerCopy(canonical.result, input.question, adapterSource, { now, deadlineAtMs, landing });
    customerCopy = copy.copy;
    copySource = copy.source;
    copyFailure = copy.failure_code;
    editorCalls = copy.provider_calls;
    editorResponse = copy.editor_response;
    // Stage 4 — MANDATORY bounded meaning checker on the SELECTED editor candidate (Founder Option 2).
    // There is no editor-on/checker-off path: an accepted stage3 edit MUST pass the checker AND its
    // deterministic validation. One attempt, same deadline; skip/reject → validated fallback.
    if (copySource === "stage3" && copy.copy && copy.editor_response) {
      // Extract the proposed components from the FLAT editor wire via the SHARED helper, so the
      // request-binding fingerprint the checker attaches is computed over exactly the same component map
      // the Web re-derives from the same wire (B02).
      const components = fidelityComponentsFromWire(copy.editor_response);
      const chk = await runFidelityCheck(canonical.result, copy.copy, components, input.question, adapterSource, { now, deadlineAtMs, landing });
      checkerCalls = chk.calls;
      if (chk.accepted) {
        checkerOutcome = chk.outcome;
      } else {
        // Checker rejected/skipped/failed → the edit is NOT displayed. Use the validated fallback and
        // carry the checker's bounded reason. Never label a skipped/failed check as passed.
        const built = buildValidatedFallback(canonical.result, landing);
        customerCopy = built.ok ? built.copy : null;
        copySource = built.ok ? "fallback" : "unavailable";
        copyFailure = built.ok ? chk.failure : `${chk.failure}|FALLBACK_${built.reason}`;
        editorResponse = null;
      }
    }
  } else {
    // Default: deterministic assembly from the validated canonical result. No provider call.
    const built = buildValidatedFallback(canonical.result, landing);
    customerCopy = built.ok ? built.copy : null;
    copySource = built.ok ? "deterministic" : "unavailable";
    copyFailure = built.ok ? null : built.reason;
  }

  const copyCalls = editorCalls + checkerCalls;
  const totalCalls = astrologyCalls + copyCalls;
  const unavailableMessage = copySource === "unavailable"
    ? CUSTOMER_COPY_UNAVAILABLE_MESSAGE[canonical.result.language as "en" | "zh-Hant"]
    : null;
  // A02: the PUBLIC failure reason for a fallback/unavailable outcome (bounded code + allow-listed field).
  const reason = (copySource === "fallback" || copySource === "unavailable") ? publicCopyFailure(copyFailure) : null;

  return Object.freeze({
    kind: "completed",
    question_mode: canonical.question_mode,
    result: canonical.result,
    customer_copy: customerCopy,
    editor_response: editorResponse,
    checker_outcome: checkerOutcome,
    copy_source: copySource,
    copy_unavailable_message: unavailableMessage,
    copy_failure_code: copyFailure,
    astrology_provider_calls: astrologyCalls,
    editor_provider_calls: editorCalls,
    checker_provider_calls: checkerCalls,
    provider_calls: totalCalls,
    // metadata.provider_calls is the ACTUAL total across all stages; the separate astrology-only
    // and copy-only counts travel alongside it, and copy_source travels here so the presentation
    // layer never guesses it. Units/persistence stay 0 (charging untouched).
    metadata: {
      ...canonical.metadata,
      provider_calls: totalCalls,
      astrology_provider_calls: astrologyCalls,
      copy_provider_calls: copyCalls,
      editor_provider_calls: editorCalls,
      checker_provider_calls: checkerCalls,
      copy_source: copySource,
      // R04 + A02 (review): carry the BOUNDED PUBLIC copy failure reason through composition → edge →
      // gateway → Web, so a backend editor-attempt-then-fallback is not later relabelled "deterministic"
      // and stripped of its reason. The internal diagnostic is mapped to a PUBLIC code (+ optional
      // allow-listed field) here so no punctuation/lowercase/field-internal detail ever reaches metadata.
      copy_redacted_failure_code: reason ? reason.code : null,
      ...(reason?.field ? { copy_failure_field: reason.field } : {}),
      ...(reason && reason.index !== undefined ? { copy_failure_index: reason.index } : {}),
    },
  });
}
