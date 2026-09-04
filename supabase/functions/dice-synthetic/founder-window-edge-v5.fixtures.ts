/** v5 Founder synthetic window/edge fixtures — per-mode two-stage orchestration
 * through executeDiceV05FreeTextCase with a mock provider (no network). Proves
 * mode routing, per-mode assembly, provider-call accounting and the Location
 * structural gate. Runs under node (mock adapter); the live Deno edge handler
 * wires the same window to the real Azure adapter. */
import {
  executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter,
} from "../_shared/dice-v0-5-window.ts";
import { createDiceV05Adapter } from "../_shared/azure-dice-adapter-v5.ts";
import { DICE_V05_RESULT_SCHEMA } from "../_shared/dice-v0-5-fixed-data.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function mock(responses: string[]): DiceV05ProviderAdapter {
  let i = 0;
  return { invoke: async () => { const c = responses[i++]; return c === undefined ? { kind: "network" as const } : { kind: "success" as const, content: c }; } };
}
const s1 = (mode: string, rule: string) => JSON.stringify({ mode, matched_rule: rule });

async function run(reqObj: unknown, responses: string[]) {
  const parsed = parseDiceV05FreeTextRequest(reqObj);
  ok(parsed, "request parses");
  return executeDiceV05FreeTextCase(parsed!, mock(responses), () => 1000);
}

async function main() {
  // Judgment.
  const jg = await run({ question: "Should I take the new job offer?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" },
    [s1("judgment", "STEP_3_JUDGMENT"), JSON.stringify({ status: "ok",
      planet_prose: "Jupiter is a major benefic in its own sign, at full strength.",
      house_prose: "House 1 is great fortune and ranked first, a supportive setting.",
      synthesis: "Both sides are favourable and remain separate, not averaged.",
      watch_out: "Expansive optimism can overreach, so keep spending realistic.", suggested_followups: ["What should I prepare first?"] })]);
  ok(jg.kind === "completed" && jg.question_mode === "judgment" && jg.provider_calls === 2, "judgment completed, 2 calls");
  ok((jg as any).result.schema === DICE_V05_RESULT_SCHEMA && (jg as any).result.planet_side && (jg as any).result.house_side, "judgment result shape");

  // Timing (Founder Decision A landing pluto/sagittarius/1).
  const tm = await run({ question: "When will my application be approved?", planet_id: "pluto", sign_id: "sagittarius", house_id: "house_1" },
    [s1("timing", "STEP_1_TIMING"), JSON.stringify({ status: "ok",
      timing_summary: "The process is inherently very slow, but the immediate environment lifts it to a medium pace.",
      synthesis: "Pluto supplies an extremely slow inherent pace; House 1 supplies a fast environment; together they fix the pace at medium. The neutral dignity affects smoothness only.",
      watch_out: null })]);
  ok(tm.kind === "completed" && tm.question_mode === "timing" && tm.provider_calls === 2, "timing completed");
  ok((tm as any).result.timing_summary && (tm as any).result.planet_side === null, "timing result shape");

  // Location (validateLocation gate) — compact wire codes for Moon/Leo/House 4
  // (p01=family_home, p02=bedroom_private, p03=kitchen_food; h01/h02/h03 house related; e01 element).
  const cand = (rank: number, p: string[], h: string[], e: string[]) => ({ rank, place: "a specific place", evidence: { p, h, e } });
  const P1 = "p01", P2 = "p02", P3 = "p03";
  const H1 = "h01", H2 = "h02", H3 = "h03";
  const E1 = "e01";
  const loc = await run({ question: "Where did I leave my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" },
    [s1("location", "STEP_2_LOCATION"), JSON.stringify({ status: "ok", most_likely_area: "at home",
      synthesis: "Home first, then narrower spots, then the heat side.",
      location_candidates: [cand(1, [P1], [H3], []), cand(2, [P2], [H1], [E1]), cand(3, [P3], [H2], [])],
      extension: null, search_order: [1, 2, 3], watch_out: "Do not check only the obvious spots.", practical_step: "Start with the bedroom, then the living areas." })]);
  ok(loc.kind === "completed" && loc.question_mode === "location" && loc.provider_calls === 2, "location completed");
  ok(Array.isArray((loc as any).result.location_candidates) && (loc as any).result.location_search_order.length === 3, "location result shape");
  ok((loc as any).result.location_candidates[0].evidence.planet_ids[0] === "planet.moon.related.family_home", "location gid expansion (semantic)");

  // Level-1 person.
  const lv = await run({ question: "What kind of person is my new manager?", planet_id: "saturn", sign_id: "libra", house_id: "house_10" },
    [s1("person", "STEP_4_LEVEL1"), JSON.stringify({ status: "ok",
      synthesis: "This manager combines Saturn's structure with Libra's cooperative manner, expressed through House 10 standing.",
      watch_out: "They value procedure, so bypassing the process may create resistance.",
      practical_step: "Learn the standards they prioritise, then present your idea in a structured way." })]);
  ok(lv.kind === "completed" && lv.question_mode === "person" && lv.provider_calls === 2, "level1 person completed");
  ok((lv as any).result.question_mode === "person" && (lv as any).result.suggested_followups.length === 0, "level1 result shape");

  // A location response whose rank-1 cites no planet key fails the §16 gate → fallback.
  const badLocJson = JSON.stringify({ status: "ok", most_likely_area: "at home", synthesis: "Home first.",
    location_candidates: [cand(1, [], [H1], []), cand(2, [P2], [], [])],
    extension: null, search_order: [1, 2], watch_out: "Check carefully.", practical_step: "Start at home." });
  // The §16 gate re-tries once, so the mock returns the same rejected response twice.
  const badLoc = await run({ question: "Where did I leave my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" },
    [s1("location", "STEP_2_LOCATION"), badLocJson, badLocJson]);
  ok(badLoc.kind === "fallback" && badLoc.code === "DICE_LOCATION_PLANET_NOT_PRIMARY", "location §16 gate rejects rank-1 without planet");

  // Provider GENERATION allowance is SEPARATE from visible-output validation, for BOTH stages: each
  // request carries max_output_tokens = 2000 (room for reasoning + output + formatting), while the
  // returned visible JSON is still measured against its visible cap (Stage-1 300, Location 580).
  const captured: Array<Record<string, unknown>> = [];
  const capturingSeq = (responses: string[]): DiceV05ProviderAdapter => {
    let i = 0;
    return { invoke: async (inp: any) => { captured.push({ max_output_tokens: inp.max_output_tokens, schema_name: inp.schema_name }); const c = responses[i++]; return c === undefined ? { kind: "network" as const } : { kind: "success" as const, content: c }; } };
  };
  const goodLoc = JSON.stringify({ status: "ok", most_likely_area: "at home", synthesis: "Home first, then narrower spots.",
    location_candidates: [cand(1, [P1], [H3], []), cand(2, [P2], [H1], [E1])], extension: null, search_order: [1, 2],
    watch_out: "Do not check only the obvious spots.", practical_step: "Start with the bedroom." });
  const reqLoc = parseDiceV05FreeTextRequest({ question: "Where did I leave my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" })!;
  const okLoc = await executeDiceV05FreeTextCase(reqLoc, capturingSeq([s1("location", "STEP_2_LOCATION"), goodLoc]), () => 1000);
  ok(okLoc.kind === "completed" && okLoc.question_mode === "location", "location completed with the generation allowance");
  ok(captured.length === 2, "two provider calls captured (Stage-1 + Stage-2)");
  ok(captured[0].schema_name === "lumis_dice_mode_selection_v5" && captured[0].max_output_tokens === 2000, "Stage-1 request carries max_output_tokens=2000 (generation allowance, NOT the 300 visible cap)");
  ok(captured[1].schema_name === "lumis_dice_location_v5_stage2" && captured[1].max_output_tokens === 2000, "Stage-2 Location request carries max_output_tokens=2000 (generation allowance, NOT the 580 visible cap)");
  // Returned visible JSON that exceeds its cap is still rejected. DISTINCT tokens (numbers) are used
  // so the string genuinely tokenises above the cap (repeated single chars BPE-merge below it); the
  // token-cap check runs on the raw content before schema parse.
  const heavy = Array.from({ length: 800 }, (_, i) => `w${i}`).join(" ");
  // Stage-1: an oversized mode-selection JSON (> 300 visible tokens) is rejected before parse.
  const oversizeS1 = JSON.stringify({ mode: "timing", matched_rule: "STEP_1_TIMING", pad: heavy });
  const bigS1 = await executeDiceV05FreeTextCase(reqLoc, capturingSeq([oversizeS1]), () => 1000);
  ok(bigS1.kind === "fallback" && bigS1.code === "DICE_OUTPUT_TOKEN_CAP", "returned Stage-1 JSON > 300 visible tokens is rejected (visible cap enforced independently of the 2000 allowance)");
  // Stage-2 Location: an oversized returned JSON (> 580 visible tokens) is rejected.
  const oversizeLoc = JSON.stringify({ status: "ok", most_likely_area: heavy, synthesis: heavy,
    location_candidates: [cand(1, [P1], [], []), cand(2, [P2], [], [])], extension: null, search_order: [1, 2], watch_out: "z", practical_step: "w" });
  const bigLoc = await executeDiceV05FreeTextCase(reqLoc, capturingSeq([s1("location", "STEP_2_LOCATION"), oversizeLoc]), () => 1000);
  ok(bigLoc.kind === "fallback" && bigLoc.code === "DICE_OUTPUT_TOKEN_CAP", "returned Stage-2 Location JSON > 580 visible tokens is rejected (visible cap enforced independently of the 2000 allowance)");

  // ---- MB-2: content-filter rejection is recognized (via the REAL v5 adapter over a mock fetch)
  // and is NEVER retried. Full pipeline: window → createDiceV05Adapter → injected fetch. No network. ----
  const CF_CONFIG = Object.freeze({ endpoint: "https://lumis-foundry-stg-sea-20260731.services.ai.azure.com", deployment: "lumis-ai-chat-stg", routeFamily: "v1" as const, apiKey: "TEST_KEY_NOT_A_SECRET" } as any);
  const seqFetch = (responses: Array<{ status: number; body: unknown }>) => {
    let n = 0;
    const impl = (async () => { const r = responses[Math.min(n, responses.length - 1)]; n += 1; return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body } as any; }) as any;
    return { impl, count: () => n };
  };
  const stage1Ok = { status: 200, body: { output_text: s1("judgment", "STEP_3_JUDGMENT") } };
  const cf400 = { status: 400, body: { error: { code: "content_filter", status: 400 } } };            // QA-reproduced envelope
  const bad400 = { status: 400, body: { error: { code: "invalid_request_error", status: 400 } } };     // ordinary non-OK → malformed (retryable)
  const cfReq = () => parseDiceV05FreeTextRequest({ question: "Will my visa be approved this year?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" })!;

  // (test 2) Stage-1 success, Stage-2 content-filter → safety, EXACTLY 2 provider calls, no retry.
  const t2 = seqFetch([stage1Ok, cf400]);
  const cf2 = await executeDiceV05FreeTextCase(cfReq(), createDiceV05Adapter(CF_CONFIG, t2.impl));
  ok(cf2.kind === "safety" && (cf2 as any).code === "DICE_CONTENT_FILTER", "MB-2 pipeline: Stage-2 content-filter → safety (non-retryable)");
  ok(cf2.provider_calls === 2 && t2.count() === 2, "MB-2 pipeline: exactly 2 provider calls / 2 adapter invocations (Stage-2 NOT retried)");

  // (test 3) Stage-1 content-filter → safety, EXACTLY 1 provider call, no Stage-2.
  const t3 = seqFetch([cf400]);
  const cf3 = await executeDiceV05FreeTextCase(cfReq(), createDiceV05Adapter(CF_CONFIG, t3.impl));
  ok(cf3.kind === "safety" && (cf3 as any).code === "DICE_CONTENT_FILTER", "MB-2 pipeline: Stage-1 content-filter → safety");
  ok(cf3.provider_calls === 1 && t3.count() === 1, "MB-2 pipeline: exactly 1 provider call, no Stage 2");

  // (test 6 contrast) an ORDINARY malformed Stage-2 STILL retries once → 3 provider calls, then fallback.
  const t6 = seqFetch([stage1Ok, bad400, bad400]);
  const mal = await executeDiceV05FreeTextCase(cfReq(), createDiceV05Adapter(CF_CONFIG, t6.impl));
  ok(mal.kind === "fallback" && (mal as any).code === "DICE_MALFORMED", "MB-2 contrast: ordinary malformed Stage-2 → fallback");
  ok(mal.provider_calls === 3 && t6.count() === 3, "MB-2 contrast: malformed retried once → 3 provider calls (transient-retry behaviour preserved)");

  // (test 7) no raw question / provider body / credential leaks into the metadata of a filtered outcome.
  const meta = JSON.stringify((cf2 as any).metadata);
  ok(!meta.includes("Will my visa") && !meta.includes("TEST_KEY_NOT_A_SECRET") && !meta.includes("content_filter") && !meta.includes("error"), "MB-2 privacy: content-filter metadata leaks no question / credential / provider body");
  ok((cf2 as any).metadata.units_consumed === 0 && (cf2 as any).metadata.persistence_writes === 0, "MB-2 privacy: filtered outcome consumes no units / writes nothing");

  console.log("dice-v0-5 founder-window-edge fixtures passed");
}
void main();
