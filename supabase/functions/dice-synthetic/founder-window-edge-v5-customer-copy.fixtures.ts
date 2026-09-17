/** Three-stage backend composition — integration fixtures (node-runnable; MOCK adapter, no network).
 * Drives executeDiceV05FreeTextCaseWithCopy end to end. The DEFAULT copy mode is deterministic:
 * the displayed customer copy is assembled from the validated canonical result and the provider is
 * NOT called for copy (proved by an adapter that throws if asked for a copy schema). Also proves
 * ONE absolute deadline reaches Stage 1 and Stage 2 (D01), and exercises the gated provider mode.
 * No raw question or provider body is emitted. */
import { executeDiceV05FreeTextCaseWithCopy } from "../_shared/dice-v0-5-window-with-copy.ts";
import { prohibitedLanguageCheck, completenessCheck, DICE_V05_CUSTOMER_COPY_SCHEMA } from "../_shared/dice-v0-5-customer-copy.ts";
import { SHARED_DEADLINE_MS, type DiceV05ProviderAdapter } from "../_shared/dice-v0-5-window.ts";

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
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", language: "en", question_mode: "judgment",
  headline: "The conditions clearly support stepping forward.",
  reading: "The wider situation favours you and keeps the choice in your own hands. The main caution is practical rather than about the opportunity itself.",
  watch_out: "Do not let optimism skip over the practical preparation.",
  practical_step: null, suggested_followups: ["What should I prepare first?"],
});
const rankyCopy = JSON.stringify({
  schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", language: "en", question_mode: "judgment",
  headline: "This is rank 1, a strong result.", reading: "The overall grade is favourable.",
  watch_out: "Watch the ranking.", practical_step: null, suggested_followups: ["What should I prepare first?"],
});

// stage3Content may be null → the adapter THROWS if asked for a copy schema (proves no copy call).
function stagedAdapter(stage3Content: string | null): DiceV05ProviderAdapter {
  return {
    invoke: async (req) => {
      if (req.schema_name === "lumis_dice_mode_selection_v5") return { kind: "success", content: JSON.stringify({ mode: "judgment", matched_rule: "STEP_3_JUDGMENT" }) };
      if (req.schema_name.endsWith("_v5_stage2")) return { kind: "success", content: stage2Judgment };
      if (req.schema_name.startsWith("lumis_dice_customer_copy_")) {
        if (stage3Content === null) throw new Error("copy provider must NOT be called in deterministic mode");
        return { kind: "success", content: stage3Content };
      }
      return { kind: "malformed" };
    },
  };
}

async function main() {
  // (1) DEFAULT deterministic path — the provider is NOT called for copy (adapter throws if asked).
  const good = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => stagedAdapter(null), () => 1000);
  ok(good.kind === "completed", "deterministic judgment completes");
  if (good.kind !== "completed") throw new Error("unreachable");
  eq(good.question_mode, "judgment", "public question_mode is judgment");
  eq(good.copy_source, "deterministic", "default copy source is deterministic");
  eq(good.astrology_provider_calls, 2, "Stage 1 + Stage 2 = 2 astrology calls");
  eq(good.provider_calls, 2, "no provider copy call in deterministic mode → total 2");
  ok(good.customer_copy, "deterministic copy present");
  eq(good.customer_copy!.question_mode, "judgment", "copy keeps the mode");
  eq(good.customer_copy!.practical_step, null, "judgment copy has no practical step");
  // S04: the deterministic judgment reading keeps BOTH axes AND the synthesis.
  ok(good.customer_copy!.reading.includes("Jupiter") && good.customer_copy!.reading.includes("House 1") && good.customer_copy!.reading.includes("outlook is supportive"), "judgment reading keeps both axes + synthesis (S04)");
  // Controlled fields come from the canonical result.
  eq(good.customer_copy!.watch_out, (good.result as any).watch_out, "watch_out is the canonical warning");
  eq(good.customer_copy!.suggested_followups.length, (good.result as any).suggested_followups.length, "follow-ups preserved 1:1 from canonical");
  eq(good.metadata.provider_calls, 2, "metadata.provider_calls total is 2");
  eq(good.metadata.copy_provider_calls, 0, "metadata copy_provider_calls is 0");
  eq(good.metadata.copy_source, "deterministic", "metadata carries the deterministic copy_source");
  eq(good.metadata.units_consumed, 0, "units stay 0"); eq(good.metadata.persistence_writes, 0, "persistence stays 0");

  // (2) D01 — ONE absolute deadline reaches Stage 1 AND Stage 2 (no fresh capture after preprocessing).
  const deadlines: number[] = [];
  let clock = 1000;
  const recordingAdapter: DiceV05ProviderAdapter = {
    invoke: async (req) => { deadlines.push(req.deadline_at_ms); return req.schema_name === "lumis_dice_mode_selection_v5" ? { kind: "success", content: JSON.stringify({ mode: "judgment", matched_rule: "STEP_3_JUDGMENT" }) } : { kind: "success", content: stage2Judgment }; },
  };
  const d = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => recordingAdapter, () => { const t = clock; clock += 10; return t; });
  ok(d.kind === "completed", "D01 case completes");
  eq(deadlines.length, 2, "D01: exactly Stage-1 + Stage-2 provider calls (deterministic copy)");
  eq(deadlines[0], 1000 + SHARED_DEADLINE_MS, "D01: Stage 1 uses the one absolute deadline captured before preprocessing");
  eq(deadlines[1], deadlines[0], "D01: Stage 2 uses the SAME absolute deadline as Stage 1 (no drift)");

  // (3) ALL-MODE editor on a Judgment question: a prohibited provider copy (rank/大吉/overall grade)
  // is REJECTED and falls back to the clean deterministic assembly; the Stage-3 call still happened.
  const prov = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => stagedAdapter(rankyCopy), () => 1000, { copyMode: "provider" });
  ok(prov.kind === "completed", "provider-mode judgment completes");
  if (prov.kind !== "completed") throw new Error("unreachable");
  eq(prov.copy_source, "fallback", "a prohibited judgment provider copy is rejected → deterministic fallback (S05)");
  eq(prov.provider_calls, 4, "provider mode with a rejected copy: Stage 1 + Stage 2 + two Stage-3 attempts (one controlled retry) = 4");
  ok(prohibitedLanguageCheck(prov.customer_copy!) === "OK" && completenessCheck(prov.customer_copy!) === "OK", "displayed judgment copy is clean + complete (canonical fallback, not prohibited provider prose)");

  // (3a) ALL-MODE editor: a CLEAN edited Judgment copy IS displayed (source stage3), and its edited
  // reading — not the deterministic assembly — reaches the customer, while the caution stays canonical.
  const goodJudgmentEditor = JSON.stringify({
    schema: DICE_V05_CUSTOMER_COPY_SCHEMA, status: "ok", language: "en", question_mode: "judgment",
    headline: "You have real support for this, and the setting is favourable.",
    reading: "Your own capacity is strong and works in your favour. The situation around you is also supportive, so the two sides agree here rather than pulling against each other.",
    watch_out: "IGNORE ME — the caution must come from canonical.", practical_step: null, suggested_followups: ["What should I prepare first?"],
  });
  const provOk = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => stagedAdapter(goodJudgmentEditor), () => 1000, { copyMode: "provider" });
  ok(provOk.kind === "completed" && provOk.copy_source === "stage3", "a clean edited Judgment copy is displayed as stage3");
  if (provOk.kind !== "completed") throw new Error("unreachable");
  ok(provOk.customer_copy!.reading.includes("the two sides agree here"), "the PROVIDER edited reading reaches the customer (not the deterministic assembly)");
  eq(provOk.customer_copy!.watch_out, (provOk.result as any).watch_out, "the caution stays the canonical warning, not the provider's");
  eq(provOk.provider_calls, 3, "clean stage3 judgment: 3 provider calls");

  // (3b) F07: the ONE absolute deadline reaches STAGE 3 as well, not only Stage 1/2. Provider copy
  // mode is enabled so the Stage-3 copy call actually runs; all three stages observe one deadline
  // captured before preprocessing (no fresh capture at Stage 3).
  const stage3Deadlines: number[] = [];
  let clock3 = 1000;
  const threeStageRecorder: DiceV05ProviderAdapter = {
    invoke: async (req) => {
      stage3Deadlines.push(req.deadline_at_ms);
      if (req.schema_name === "lumis_dice_mode_selection_v5") return { kind: "success", content: JSON.stringify({ mode: "judgment", matched_rule: "STEP_3_JUDGMENT" }) };
      if (req.schema_name.startsWith("lumis_dice_customer_copy_")) return { kind: "success", content: goodJudgmentEditor };
      return { kind: "success", content: stage2Judgment };
    },
  };
  const three = await executeDiceV05FreeTextCaseWithCopy(JUDGMENT_REQUEST, () => threeStageRecorder, () => { const t = clock3; clock3 += 10; return t; }, { copyMode: "provider" });
  ok(three.kind === "completed", "provider-mode three-stage completes");
  eq(stage3Deadlines.length, 3, "F07: Stage 1 + Stage 2 + Stage 3 each made exactly one provider call");
  eq(stage3Deadlines[0], 1000 + SHARED_DEADLINE_MS, "F07: Stage 1 uses the one absolute deadline captured before preprocessing");
  eq(stage3Deadlines[1], stage3Deadlines[0], "F07: Stage 2 shares the same absolute deadline");
  eq(stage3Deadlines[2], stage3Deadlines[0], "F07: Stage 3 (copy) shares the SAME absolute deadline — no fresh capture at Stage 3");

  // (4) Route-review passes through unchanged, with no customer copy.
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
