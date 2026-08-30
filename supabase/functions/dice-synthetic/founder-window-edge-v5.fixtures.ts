/** v5 Founder synthetic window/edge fixtures — per-mode two-stage orchestration
 * through executeDiceV05FreeTextCase with a mock provider (no network). Proves
 * mode routing, per-mode assembly, provider-call accounting and the Location
 * structural gate. Runs under node (mock adapter); the live Deno edge handler
 * wires the same window to the real Azure adapter. */
import {
  executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter,
} from "../_shared/dice-v0-5-window.ts";
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

  // Location (validateLocation gate) — real semantic evidence keys for Moon/Leo/House 4.
  const cand = (rank: number, p: string[], h: string[], e: string[]) => ({ rank, place: "a specific place", evidence: { p, h, e } });
  const P1 = "p_family_home", P2 = "p_bedroom_private", P3 = "p_kitchen_food";
  const H1 = "h_family_property", H2 = "h_household_room", H3 = "h_under_furniture";
  const E1 = "e_heat_or_fire";
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

  console.log("dice-v0-5 founder-window-edge fixtures passed");
}
void main();
