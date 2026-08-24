import { executeDiceV04FreeTextCase, parseDiceV04FreeTextRequest, type DiceV04FreeTextRequest } from "./dice-v0-4-window.ts";
import type { DiceV04InvokeInput, DiceV04ProviderAdapter, DiceV04ProviderResult } from "./azure-dice-adapter-v4.ts";

function ok(v: unknown, label: string): asserts v { if (!v) throw new Error("FAIL: " + label); }
function eq(a: unknown, b: unknown, label: string): void { if (a !== b) throw new Error(`FAIL: ${label} (got ${JSON.stringify(a)})`); }

const judgmentResult = {
  schema: "lumis_dice_interpretation_v4", status: "completed", language: "en", question_mode: "judgment",
  planet_layer: null, sign_layer: null, house_layer: null,
  synthesis: "Taking this on is well supported: the core capability is strong and the setting favours you. Still, a strong result depends on handling the basics.",
  judgment_code: "favourable", judgment_summary: "Favourable overall, with aligned capability and environment.",
  timing_summary: null, watch_out: "Do not treat a favourable trend as a reason to skip the basics, or momentum can outrun preparation.",
  practical_step: null, suggested_followups: ["What most needs preparing first?"],
};

// Adapter that plays stage 1 then stage 2 from a script.
function scriptedAdapter(script: DiceV04ProviderResult[]): { adapter: DiceV04ProviderAdapter; calls: () => number } {
  let i = 0;
  return {
    calls: () => i,
    adapter: Object.freeze({
      async invoke(input: DiceV04InvokeInput): Promise<DiceV04ProviderResult> {
        // sanity: stage 1 uses the mode-selection schema, stage 2 the interpretation schema
        ok(input.schema_name === "lumis_dice_mode_selection_v4" || input.schema_name === "lumis_dice_interpretation_v4", "known schema name per stage");
        const next = script[Math.min(i, script.length - 1)];
        i += 1;
        return next;
      },
    }),
  };
}
const now = () => 1_000_000; // fixed clock, well inside the deadline

const req: DiceV04FreeTextRequest = { question: "Should I accept this promotion?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" };

// Happy path: mode select judgment -> interpretation completed (2 provider calls).
{
  const { adapter, calls } = scriptedAdapter([
    { kind: "success", content: JSON.stringify({ selection: "judgment" }) },
    { kind: "success", content: JSON.stringify(judgmentResult) },
  ]);
  const out = await executeDiceV04FreeTextCase(req, adapter, now);
  eq(out.kind, "completed", "judgment run completes");
  if (out.kind === "completed") {
    eq(out.question_mode, "judgment", "question_mode is judgment");
    eq(out.provider_calls, 2, "two provider calls (mode + interpret)");
    eq(out.metadata.question_mode, "judgment", "metadata records question_mode");
    eq(out.result.judgment_code, "favourable", "judgment code surfaced");
  }
  eq(calls(), 2, "adapter invoked exactly twice");
}

// Stage 1 route_review -> stop before stage 2 (only one provider call).
{
  const { adapter, calls } = scriptedAdapter([
    { kind: "success", content: JSON.stringify({ selection: "route_review_required" }) },
    { kind: "success", content: JSON.stringify(judgmentResult) },
  ]);
  const out = await executeDiceV04FreeTextCase(req, adapter, now);
  eq(out.kind, "route_review", "stage-1 route review stops");
  eq(out.provider_calls, 1, "only the mode-selection call is made");
  eq(calls(), 1, "adapter invoked once");
}

// Deterministic hard gate (bundled) -> no provider calls at all.
{
  const { adapter, calls } = scriptedAdapter([{ kind: "success", content: "{}" }]);
  const bundled = { ...req, question: "Will I get the promotion and when will it happen?" };
  const out = await executeDiceV04FreeTextCase(bundled, adapter, now);
  ok(out.kind === "bundled" || out.kind === "route_review", "bundled/multi-intent hard-gated");
  eq(out.provider_calls, 0, "hard gate makes no provider call");
  eq(calls(), 0, "adapter never invoked for a hard-gated question");
}

// Stage 2 malformed once -> retry -> success.
{
  const { adapter, calls } = scriptedAdapter([
    { kind: "success", content: JSON.stringify({ selection: "judgment" }) },
    { kind: "success", content: "not json" },
    { kind: "success", content: JSON.stringify(judgmentResult) },
  ]);
  const out = await executeDiceV04FreeTextCase(req, adapter, now);
  eq(out.kind, "completed", "stage-2 malformed retries then completes");
  eq(calls(), 3, "one mode call + two interpretation attempts");
}

// Stage 2 malformed twice -> fallback.
{
  const { adapter } = scriptedAdapter([
    { kind: "success", content: JSON.stringify({ selection: "judgment" }) },
    { kind: "success", content: "still not json" },
  ]);
  const out = await executeDiceV04FreeTextCase(req, adapter, now);
  eq(out.kind, "fallback", "persistent malformed -> fallback");
}

// Request validation.
eq(parseDiceV04FreeTextRequest({ question: "Hi", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" })?.question, "Hi", "valid request accepted");
eq(parseDiceV04FreeTextRequest({ question: "", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }), null, "empty question rejected");
eq(parseDiceV04FreeTextRequest({ question: "x", planet_id: "chiron", sign_id: "sagittarius", house_id: "house_1" }), null, "invalid planet rejected");
eq(parseDiceV04FreeTextRequest({ question: "x", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1", extra: 1 }), null, "extra key rejected");

console.log("Dice v4 two-stage window passed: hard gates, mode-select stage 1, interpret stage 2, retry, route_review, zero-call gating.");
