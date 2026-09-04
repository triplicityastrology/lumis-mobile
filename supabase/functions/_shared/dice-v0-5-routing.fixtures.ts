/** v5 Routing fixtures (§20.1) — all 19 RT rows run through the REAL v5 Stage-0 gate as
 * FAIL-FAST assertions (no non-fatal "findings"), plus Stage-1 schema/pairing and, for pass
 * rows, the window with a mocked Stage-1 proving the routed mode and provider-call count.
 * The v5 gate (dice-v0-5-question-gate.ts) wraps the shared v3 classifier without editing it. */
import { classifyDiceV05QuestionRequest } from "./dice-v0-5-question-gate.ts";
import {
  parseDiceV05Stage1, matchedRuleOf, stage2ModeOf, diceV05Stage1Schema,
  DICE_V05_ROUTE_REVIEW_LITERAL, type DiceV05Mode,
} from "./dice-v0-5-interpretation-contract.ts";
import { executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter } from "./dice-v0-5-window.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

/* ---- Stage-1 schema + pairing (deterministic) ---- */
const rows: Array<[string, string, string]> = [
  ["timing", "STEP_1_TIMING", "timing"], ["location", "STEP_2_LOCATION", "location"], ["judgment", "STEP_3_JUDGMENT", "judgment"],
  ["person", "STEP_4_LEVEL1", "level1"], ["reason", "STEP_4_LEVEL1", "level1"], ["thing_or_situation", "STEP_4_LEVEL1", "level1"],
];
for (const [mode, rule, s2] of rows) {
  const r = parseDiceV05Stage1(JSON.stringify({ mode, matched_rule: rule }));
  ok(r && r.kind === "mode" && r.mode === mode && r.matched_rule === rule, `pairing ${mode}`);
  eq(matchedRuleOf(mode as any), rule, `matchedRuleOf ${mode}`);
  eq(stage2ModeOf(mode as any), s2, `stage2ModeOf ${mode}`);
}
ok((parseDiceV05Stage1(JSON.stringify({ mode: "route_review_required", matched_rule: "ROUTE_REVIEW" })) as any)?.kind === "route_review", "route_review accepted");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "timing", matched_rule: "STEP_2_LOCATION" })) === null, "mismatch rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "who", matched_rule: "STEP_4_LEVEL1" })) === null, "unknown mode rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "timing", matched_rule: "STEP_1_TIMING", extra: 1 })) === null, "extra key rejected");
const sc: any = diceV05Stage1Schema();
eq(sc.additionalProperties, false, "stage1 schema closed");

/* ---- The 19 RT rows: real v5 Stage-0 + (pass rows) mocked window routing ---- */
type S0 = "pass" | "unclear" | "bundled" | "safety";
type Row = { id: string; q: string; lang: "en" | "zh-Hant"; s0: S0; mode: DiceV05Mode | "route_review_required" | null };
const RT: Row[] = [
  { id: "RT-01", q: "When will I receive the exam result?", lang: "en", s0: "pass", mode: "timing" },
  { id: "RT-02", q: "幾時會有面試結果？", lang: "zh-Hant", s0: "pass", mode: "timing" },
  { id: "RT-03", q: "How soon will the parcel move?", lang: "en", s0: "pass", mode: "timing" },
  { id: "RT-04", q: "我隻結婚戒指而家喺邊？", lang: "zh-Hant", s0: "pass", mode: "location" },
  { id: "RT-05", q: "Where is my passport now?", lang: "en", s0: "pass", mode: "location" },
  { id: "RT-06", q: "Will I find my passport?", lang: "en", s0: "pass", mode: "judgment" },
  { id: "RT-07", q: "我應唔應該轉呢份工？", lang: "zh-Hant", s0: "pass", mode: "judgment" },
  { id: "RT-08", q: "Will my visa be approved this year?", lang: "en", s0: "pass", mode: "judgment" },
  { id: "RT-09", q: "今年會唔會批到我個簽證？", lang: "zh-Hant", s0: "pass", mode: "judgment" },
  { id: "RT-10", q: "What kind of job should I look for next?", lang: "en", s0: "pass", mode: "thing_or_situation" },
  { id: "RT-11", q: "我應該搵咩類型嘅工作？", lang: "zh-Hant", s0: "pass", mode: "thing_or_situation" },
  { id: "RT-12", q: "我新上司係個點嘅人？", lang: "zh-Hant", s0: "pass", mode: "person" },
  { id: "RT-13", q: "Why do my projects keep stalling?", lang: "en", s0: "pass", mode: "reason" },
  { id: "RT-14", q: "唔知呀", lang: "zh-Hant", s0: "unclear", mode: null },
  { id: "RT-15", q: "我個application會唔會批？幾時會批？", lang: "zh-Hant", s0: "bundled", mode: null },
  { id: "RT-16", q: "Will it be approved, and where should I mail it?", lang: "en", s0: "bundled", mode: null },
  { id: "RT-17", q: "我到底係應該搬屋定係唔搬好呢，其實我又想知幾時搬最順？", lang: "zh-Hant", s0: "bundled", mode: null },
  { id: "RT-18", q: "Should I take the offer, or is it a bad idea?", lang: "en", s0: "pass", mode: "judgment" },
  { id: "RT-19", q: "我想知呢件事會點發展，但又唔肯定係咪應該繼續", lang: "zh-Hant", s0: "pass", mode: "route_review_required" },
];

// Map a Stage-0 decision to a coarse category for the §20.1 expectation.
function s0cat(code: string): S0 {
  if (code.includes("SAFETY") || code.includes("PROFESSIONAL")) return "safety";
  if (code.includes("BUNDLED") || code.includes("CHOICE") || code.includes("MULTIPLE")) return "bundled";
  return "unclear"; // UNCLEAR / EMPTY / OVERSIZED / SCOPE etc.
}
// A mocked adapter that replays Stage-1 then a Stage-2 literal (2 calls for a routed mode; a
// route_review_required Stage-1 short-circuits so only 1 call is made).
const mockRoute = (mode: string, rule: string, s2literal: unknown): DiceV05ProviderAdapter => {
  let i = 0; const seq = [JSON.stringify({ mode, matched_rule: rule }), JSON.stringify(s2literal)];
  return { invoke: async () => { const c = seq[i++]; return c === undefined ? { kind: "network" as const } : { kind: "success" as const, content: c }; } };
};
const mockStage1RouteReview = (): DiceV05ProviderAdapter => {
  let i = 0; const seq = [JSON.stringify({ mode: "route_review_required", matched_rule: "ROUTE_REVIEW" })];
  return { invoke: async () => { const c = seq[i++]; return c === undefined ? { kind: "network" as const } : { kind: "success" as const, content: c }; } };
};

async function main() {
for (const r of RT) {
  const d = classifyDiceV05QuestionRequest({ question: r.q });
  const actual: S0 = d.accepted ? "pass" : s0cat(d.code);
  // FAIL-FAST: every RT row's Stage-0 category must equal the §20.1 expectation.
  eq(actual, r.s0, `${r.id} Stage-0 category (${d.accepted ? "accepted" : (d as any).code})`);
  // Exact stop codes for the deterministic rejections.
  if (r.s0 === "unclear") ok(!d.accepted && (d as any).code === "DICE_QUESTION_UNCLEAR", `${r.id} exact UNCLEAR`);
  if (r.s0 === "bundled") ok(!d.accepted && (d as any).code === "DICE_QUESTION_BUNDLED", `${r.id} exact BUNDLED`);

  if (r.s0 !== "pass") continue;
  ok(d.accepted, `${r.id} accepted at Stage-0`);
  const req = parseDiceV05FreeTextRequest({ question: r.q, planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" })!;

  if (r.mode === "route_review_required") {
    // RT-19: passes Stage-0, Stage-1 returns route_review_required → exactly ONE provider call.
    const outcome = await executeDiceV05FreeTextCase(req, mockStage1RouteReview(), () => 1000);
    ok(outcome.kind === "route_review" && outcome.provider_calls === 1, `${r.id} → Stage-1 route_review, 1 call`);
  } else {
    // Routed modes: Stage-1 selects the mode, Stage-2 literal proves the pipeline reached it (2 calls).
    const s2 = stage2ModeOf(r.mode as DiceV05Mode);
    const outcome = await executeDiceV05FreeTextCase(req, mockRoute(r.mode as string, matchedRuleOf(r.mode as DiceV05Mode), (DICE_V05_ROUTE_REVIEW_LITERAL as any)[s2]), () => 1000);
    ok(outcome.metadata.question_mode === r.mode && outcome.provider_calls === 2, `${r.id} window routed to ${r.mode} (2 calls)`);
  }
}

// RT-14 is a Stage-0 rejection with zero provider calls; RT-08 reaches Stage-1.
{
  const rt14 = classifyDiceV05QuestionRequest({ question: "唔知呀" });
  ok(!rt14.accepted && rt14.effects.provider_calls === 0, "RT-14 is a Stage-0 rejection (0 provider calls)");
  ok(classifyDiceV05QuestionRequest({ question: "Will my visa be approved this year?" }).accepted, "RT-08 passes Stage-0");
}

// The v5 gate must not change v3 behaviour for a genuine A-or-B choice (distinct options) or a
// real multi-"？" bundle: both stay rejected.
ok(!classifyDiceV05QuestionRequest({ question: "Should I take job A or job B?" }).accepted, "genuine A-or-B choice still rejected");
ok(!classifyDiceV05QuestionRequest({ question: "我個application會唔會批？幾時會批？" }).accepted, "multi-？ bundle still rejected");

// The bundled detector is STRUCTURAL: an additive "又想知 / 仲想問" connective is bundled ONLY when a
// complete first intention precedes it AND a distinct interrogative follows it. Single questions
// that merely OPEN with such a connective must PASS Stage 0 (not tailored to RT-17).
const bundledCode = (q: string) => { const d = classifyDiceV05QuestionRequest({ question: q }); return d.accepted ? "pass" : (d as any).code; };
// (a) single questions that open with the connective — MUST pass.
for (const q of ["我又想知佢會唔會返嚟？", "其實我仲想問幾時會有結果？", "我又想知本護照喺邊度？"]) {
  ok(classifyDiceV05QuestionRequest({ question: q }).accepted, `single-question control passes Stage-0: ${q}`);
}
// (b) genuine two-question variants beyond RT-17 — MUST be bundled (first intention + connective + second interrogative).
for (const q of ["我應唔應該轉工，又想知幾時轉最好？", "佢會唔會鍾意我，同埋我想知幾時應該表白？"]) {
  eq(bundledCode(q), "DICE_QUESTION_BUNDLED", `genuine two-question variant bundled: ${q}`);
}
// (c) the SECOND question can appear at a LATER connective, and the second interrogative may be a
// how/what-kind form (點樣/如何/…): the detector scans EVERY connective, not just the first.
for (const q of ["我又想知佢會唔會返嚟，另外我想知幾時返？", "我應唔應該轉工，又想知新工作會係點樣？"]) {
  const d = classifyDiceV05QuestionRequest({ question: q });
  eq(bundledCode(q), "DICE_QUESTION_BUNDLED", `later-connective / how-form bundled: ${q}`);
  ok(!d.accepted && d.effects.provider_calls === 0, `${q}: zero provider calls`);
}

// Test 6 (§20 workbook) — the EXACT bundled question driven through the REAL v5 pipeline
// (executeDiceV05FreeTextCase), NOT a manually forced bundled outcome. The provider adapter is a
// call counter: it must NEVER be invoked, proving the Stage-0 hard gate rejects before Stage-1.
{
  const TEST6_Q = "我個application會唔會批？幾時會批？";
  let adapterCalls = 0;
  const counting: DiceV05ProviderAdapter = { invoke: async () => { adapterCalls += 1; return { kind: "network" as const }; } };
  const req = parseDiceV05FreeTextRequest({ question: TEST6_Q, planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" })!;
  const outcome = await executeDiceV05FreeTextCase(req, counting, () => 1000);
  ok(outcome.kind === "bundled" && (outcome as any).code === "DICE_QUESTION_BUNDLED", "Test 6 real gate: bundled hard-gate outcome");
  ok(outcome.provider_calls === 0 && adapterCalls === 0, "Test 6 real gate: ZERO provider calls (adapter never invoked)");
  ok(outcome.metadata.units_consumed === 0 && outcome.metadata.persistence_writes === 0, "Test 6 real gate: no units / no persistence");
}

console.log("dice-v0-5 routing fixtures passed");
}
void main();
