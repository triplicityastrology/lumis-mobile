/** Test-9 routing correction (node-runnable; MOCK adapter, no network).
 * "should"/"應該"/"應唔應該" must route by the ANSWER requested, not the word:
 *   我應該搵咩工作？ / What kind of job should I look for? -> thing_or_situation
 *   我應唔應該搵工作？ / Should I look for a new job?      -> judgment
 * The live model makes the decision; this fixture proves (a) the Stage-1 prompt now carries the
 * exact contrast + example questions, (b) the Stage-0 gate accepts the exact Test-9 questions, and
 * (c) the pipeline preserves the routed public mode end to end. The four-row intent table is the
 * live/QA authority. Controlling order Timing -> Location -> Judgment -> Level 1 is unchanged. */
import { DICE_V05_BLOCK, stage2ModeOf, parseDiceV05Stage1, matchedRuleOf } from "./dice-v0-5-interpretation-contract.ts";
import { classifyDiceV05QuestionRequest } from "./dice-v0-5-question-gate.ts";
import { executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest, type DiceV05ProviderAdapter } from "./dice-v0-5-window.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

async function main() {
/* ---- (a) the Stage-1 prompt carries the requested-answer contrast + exact examples ---- */
const s1 = DICE_V05_BLOCK.stage1;
ok(/classify a "should"\/"應該"\/"應唔應該" question by the answer it requests/i.test(s1), "prompt states the should/應該 contrast");
for (const ex of ["我應該搵咩工作？", "What kind of job should I look for?", "我應唔應該搵工作？", "Should I look for a new job?"]) {
  ok(s1.includes(ex), `prompt cites the exact example: ${ex}`);
}
ok(s1.includes("A When or Where question still takes priority"), "prompt keeps Timing/Location priority");

/* ---- (b) Stage-0 accepts the exact Test-9 questions (not hard-gated) ---- */
const T9 = [
  { q: "我應該搵咩工作？", mode: "thing_or_situation" },
  { q: "What kind of job should I look for?", mode: "thing_or_situation" },
  { q: "我應唔應該搵工作？", mode: "judgment" },
  { q: "Should I look for a new job?", mode: "judgment" },
] as const;
for (const t of T9) {
  const d = classifyDiceV05QuestionRequest({ question: t.q });
  ok(d.accepted, `Stage-0 accepts Test-9 question -> ${t.mode}`);
  // The routed public mode pairs with the correct matched_rule and Stage-2 family.
  const rule = matchedRuleOf(t.mode);
  ok(parseDiceV05Stage1(JSON.stringify({ mode: t.mode, matched_rule: rule })), `pairing valid for ${t.mode}`);
}
eq(stage2ModeOf("thing_or_situation"), "level1", "thing_or_situation runs the Level-1 Stage-2 family");
eq(stage2ModeOf("judgment"), "judgment", "judgment runs the judgment Stage-2 family");

/* ---- (c) pipeline preserves the routed public mode end to end (mocked Stage-1 decision) ---- */
const level1Stage2 = JSON.stringify({ status: "ok",
  synthesis: "你較適合需要溝通、分析與協調的工作，而且環境最好相對穩定，讓你可以長期累積經驗。",
  watch_out: "選擇太混亂或變動太大的環境，容易令你分心。", practical_step: "先選一個穩定的方向，累積經驗後再考慮轉變。" });
const judgmentStage2 = JSON.stringify({ status: "ok",
  planet_prose: "木星屬有利的一面，帶來擴展與信心。", house_prose: "第一宮令這件事掌握在你自己手中。",
  synthesis: "整體條件支持你主動踏出一步，同時保持務實。", watch_out: "不要因為太樂觀而忽略實際準備。",
  suggested_followups: ["我應該先準備甚麼？"] });
const routeAdapter = (mode: string, rule: string, stage2: string): DiceV05ProviderAdapter => ({
  invoke: async (req) => req.schema_name === "lumis_dice_mode_selection_v5"
    ? { kind: "success", content: JSON.stringify({ mode, matched_rule: rule }) }
    : { kind: "success", content: stage2 },
});

const thingReq = parseDiceV05FreeTextRequest({ question: "我應該搵咩工作？", planet_id: "mercury", sign_id: "libra", house_id: "house_4" });
ok(thingReq, "thing_or_situation request parses");
const thing = await executeDiceV05FreeTextCase(thingReq!, () => routeAdapter("thing_or_situation", "STEP_4_LEVEL1", level1Stage2), () => 1000);
ok(thing.kind === "completed" && thing.question_mode === "thing_or_situation", "我應該搵咩工作？ completes as thing_or_situation (not judgment)");

const judgeReq = parseDiceV05FreeTextRequest({ question: "我應唔應該搵工作？", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" });
ok(judgeReq, "judgment request parses");
const judge = await executeDiceV05FreeTextCase(judgeReq!, () => routeAdapter("judgment", "STEP_3_JUDGMENT", judgmentStage2), () => 1000);
ok(judge.kind === "completed" && judge.question_mode === "judgment", "我應唔應該搵工作？ completes as judgment");

console.log("dice-v0-5 Test-9 routing fixtures passed");
}
main().catch((error) => { console.error(error); throw error; });
