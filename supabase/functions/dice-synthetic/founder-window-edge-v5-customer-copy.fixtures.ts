/** Three-stage backend composition — integration fixtures (node-runnable; MOCK adapter, no network).
 * Drives executeDiceV05FreeTextCaseWithCopy end to end: Stage-1 route -> Stage-2 astrology ->
 * Stage-3 customer copy, keyed off the schema_name the adapter is asked for. Proves the completed
 * envelope carries a validated customer_copy (source stage3), that a Stage-3 failure yields the
 * deterministic fallback (never a broken card, no throw), and that a route-review passes through
 * with no customer copy. No raw question or provider body is emitted. */
import { executeDiceV05FreeTextCaseWithCopy } from "../_shared/dice-v0-5-window-with-copy.ts";
import { prohibitedLanguageCheck, completenessCheck, DICE_V05_CUSTOMER_COPY_SCHEMA } from "../_shared/dice-v0-5-customer-copy.ts";
import type { DiceV05ProviderAdapter } from "../_shared/dice-v0-5-window.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

const JUDGMENT_REQUEST = Object.freeze({ question: "Should I accept this promotion?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" });

// Stage-2 judgment content (English, within caps, no blended-grade terms).
const stage2Judgment = JSON.stringify({
  status: "ok",
  planet_prose: "Jupiter here is a strong, benefic influence, favouring growth and confident expansion.",
  house_prose: "House 1 keeps the matter firmly in your own hands and initiative.",
  synthesis: "The outlook is supportive: this is a favourable setting to step forward, while keeping your plans realistic.",
  watch_out: "Do not let optimism skip over the practical preparation.",
  suggested_followups: ["What should I prepare first?"],
});
const goodCopy = JSON.stringify({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "judgment",
  headline: "The conditions clearly support stepping forward.",
  reading: "The wider situation favours you and keeps the choice in your own hands. The main caution is practical rather than about the opportunity itself.",
  watch_out: "Stay optimistic, but do not skip the practical preparation.",
  practical_step: null, suggested_followups: ["What should I prepare first?"],
});
const rankyCopy = JSON.stringify({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, language: "en", question_mode: "judgment",
  headline: "This is rank 1, a strong result.", reading: "The overall grade is favourable.",
  watch_out: "Watch the ranking.", practical_step: null, suggested_followups: ["What next?"],
});

function stagedAdapter(stage3Content: string): DiceV05ProviderAdapter {
  return {
    invoke: async (req) => {
      if (req.schema_name === "lumis_dice_mode_selection_v5") return { kind: "success", content: JSON.stringify({ mode: "judgment", matched_rule: "STEP_3_JUDGMENT" }) };
      if (req.schema_name.endsWith("_v5_stage2")) return { kind: "success", content: stage2Judgment };
      if (req.schema_name.startsWith("lumis_dice_customer_copy_")) return { kind: "success", content: stage3Content };
      return { kind: "malformed" };
    },
  };
}

async function main() {
  // (1) Full three-stage happy path: Stage 3 accepted.
  const good = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => stagedAdapter(goodCopy), () => 1000);
  ok(good.kind === "completed", "three-stage judgment completes");
  if (good.kind !== "completed") throw new Error("unreachable");
  eq(good.question_mode, "judgment", "public question_mode is judgment");
  eq(good.astrology_provider_calls, 2, "Stage 1 + Stage 2 = 2 astrology calls");
  eq(good.provider_calls, 3, "Stage 1 + Stage 2 + Stage 3 = 3 provider calls");
  eq(good.copy_source, "stage3", "customer copy came from Stage 3");
  eq(good.customer_copy.schema, DICE_V05_CUSTOMER_COPY_SCHEMA, "envelope carries the customer-copy schema");
  eq(good.customer_copy.question_mode, "judgment", "copy keeps the mode");
  eq(good.customer_copy.practical_step, null, "judgment copy has no practical step");
  eq((good.result as any).question_mode, "judgment", "canonical Stage-2 result retained separately");
  eq((good.result as any).planet_side !== null && (good.result as any).house_side !== null, true, "canonical judgment keeps both axes");
  eq(good.metadata.units_consumed, 0, "units stay 0"); eq(good.metadata.persistence_writes, 0, "persistence stays 0");

  // (2) Stage-3 emits a prohibited term (rank/overall grade) -> deterministic fallback, no throw.
  const fb = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => stagedAdapter(rankyCopy), () => 1000);
  ok(fb.kind === "completed", "prohibited Stage-3 copy still completes (fallback)");
  if (fb.kind !== "completed") throw new Error("unreachable");
  eq(fb.copy_source, "fallback", "prohibited copy falls back to deterministic customer copy");
  eq(prohibitedLanguageCheck(fb.customer_copy), "OK", "fallback copy carries no prohibited term");
  eq(completenessCheck(fb.customer_copy), "OK", "fallback copy has no fragment");
  eq((fb.result as any).synthesis, (good.result as any).synthesis, "canonical Stage-2 result is unchanged by Stage-3 outcome");

  // (3) Route-review passes through unchanged, with no customer copy.
  const rr = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => ({
    invoke: async (req) => req.schema_name === "lumis_dice_mode_selection_v5"
      ? { kind: "success", content: JSON.stringify({ mode: "route_review_required", matched_rule: "ROUTE_REVIEW" }) }
      : { kind: "malformed" },
  }), () => 1000);
  ok(rr.kind === "route_review", "route-review passes through the composition");
  ok(!("customer_copy" in (rr as any)), "route-review carries no customer copy");

  console.log("dice-v0-5 three-stage customer-copy edge fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
