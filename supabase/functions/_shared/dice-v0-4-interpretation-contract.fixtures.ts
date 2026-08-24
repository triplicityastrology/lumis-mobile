import {
  DICE_V04_RESULT_SCHEMA,
  buildDiceV04InterpretationPrompt,
  buildDiceV04ModeSelectionPrompt,
  buildDiceV04RoutePayload,
  parseDiceV04ModeSelection,
  parseDiceV04Output,
  type DiceV04Landing,
  type DiceV04QuestionMode,
} from "./dice-v0-4-interpretation-contract.ts";
import { presentDiceV04Result, presentDiceV04Deterministic } from "./dice-v0-4-presentation.ts";

function ok(v: unknown, label: string): asserts v { if (!v) throw new Error("FAIL: " + label); }
function eq(a: unknown, b: unknown, label: string): void { if (a !== b) throw new Error(`FAIL: ${label} (got ${JSON.stringify(a)})`); }
const base = (mode: DiceV04QuestionMode, language: "en" | "zh-Hant") => ({
  schema: DICE_V04_RESULT_SCHEMA, status: "completed", language, question_mode: mode,
  planet_layer: null, sign_layer: null, house_layer: null,
  judgment_code: null, judgment_summary: null, timing_summary: null,
  practical_step: null, suggested_followups: [] as string[],
});
const run = (raw: unknown, mode: DiceV04QuestionMode, language: "en" | "zh-Hant" = "en") =>
  parseDiceV04Output(JSON.stringify(raw), { mode, language });

// ---------- Stage 1: mode selection ----------
const selPrompt = buildDiceV04ModeSelectionPrompt("Should I accept this job?", "en");
ok(/thing_or_situation/.test(selPrompt) && /route_review_required/.test(selPrompt), "mode-selection prompt lists modes + route review");
for (const m of ["person", "thing_or_situation", "reason", "location", "timing", "judgment"] as const) {
  eq(parseDiceV04ModeSelection(JSON.stringify({ selection: m }))?.kind === "mode" && (parseDiceV04ModeSelection(JSON.stringify({ selection: m })) as { mode: string }).mode, m, `selection ${m}`);
}
eq(parseDiceV04ModeSelection(JSON.stringify({ selection: "route_review_required" }))?.kind, "route_review", "selection route review");
eq(parseDiceV04ModeSelection(JSON.stringify({ selection: "bogus" })), null, "bad selection rejected");
eq(parseDiceV04ModeSelection(JSON.stringify({ selection: "judgment", extra: 1 })), null, "extra key rejected");

// ---------- Stage 2 payload least-data gating ----------
const landing: DiceV04Landing = { planet: "jupiter", sign: "sagittarius", house: "house_1" };
const locPayload = JSON.stringify(buildDiceV04RoutePayload("location", landing));
ok(/direction/.test(locPayload) && /places/.test(locPayload), "location payload includes direction/places");
const judgPayload = JSON.stringify(buildDiceV04RoutePayload("judgment", landing));
ok(!/direction/.test(judgPayload) && !/places/.test(judgPayload), "judgment payload excludes direction/places");
ok(/fortune/.test(judgPayload) && /dignity/.test(judgPayload), "judgment payload includes fortune + dignity");
const timePayload = JSON.stringify(buildDiceV04RoutePayload("timing", landing));
ok(/speed/.test(timePayload) && !/direction/.test(timePayload), "timing payload includes speed, no direction");
const personPayload = JSON.stringify(buildDiceV04RoutePayload("person", landing));
ok(!/direction/.test(personPayload) && !/"external_speed"/.test(personPayload) && !/external_fortune/.test(personPayload), "person payload is Level-1 only");
const judgPrompt = buildDiceV04InterpretationPrompt("judgment", "Should I go?", "en", landing);
ok(/吉／凶／平/.test(judgPrompt) && /strongly_favourable/.test(judgPrompt), "judgment prompt carries 吉凶平 + codes");
ok(!/direction/.test(judgPrompt), "judgment prompt carries no location direction data");

// ---------- Judgment (Working Holiday, Jupiter/Sagittarius/House 1) ----------
const judgment = {
  ...base("judgment", "en"),
  planet_layer: "Jupiter is a major benefic with strong capability here.",
  sign_layer: "Sagittarius is Jupiter's rulership, a strengthened dignity.",
  house_layer: "House 1 is a strongly favourable environment that gives you initiative.",
  synthesis: "Taking the Working Holiday is well supported: Jupiter's capacity for growth is strengthened in its own sign and lands in a first-house setting you can drive yourself. The core conditions are favourable, though a strong result still depends on handling the practical basics.",
  judgment_code: "strongly_favourable",
  judgment_summary: "Strongly favourable overall, and especially suited to being started on your own initiative; the core capability and environment are aligned.",
  watch_out: "Strong Jupiter can tempt you to overestimate how much you can take on, so don't treat a favourable trend as a reason to skip the basics.",
  suggested_followups: ["What most needs preparing before I leave?", "What will the biggest challenge of this trip be?"],
};
const jOut = run(judgment, "judgment");
ok(jOut?.kind === "completed", "judgment accepted");
eq(run({ ...judgment, practical_step: "Do a thing." }, "judgment"), null, "judgment rejects practical_step");
eq(run({ ...judgment, suggested_followups: [] }, "judgment"), null, "judgment requires 1-3 followups");
eq(run({ ...judgment, suggested_followups: ["a?", "b?", "c?", "d?"] }, "judgment"), null, "judgment rejects >3 followups");
eq(run({ ...judgment, judgment_code: null }, "judgment"), null, "judgment requires code");
eq(run({ ...judgment, timing_summary: "soon." }, "judgment"), null, "judgment rejects timing_summary");
eq(run({ ...judgment, watch_out: "One risk is overusing Sagittarius's mode of expression." }, "judgment"), null, "placeholder watch-out rejected");

// ---------- Timing (Pluto/Sagittarius/House 1) ----------
const timing = {
  ...base("timing", "en"),
  planet_layer: "Pluto carries the slowest intrinsic pace.",
  sign_layer: "Sagittarius is neutral for Pluto's dignity.",
  house_layer: "House 1 is a fast external environment with little obstruction.",
  synthesis: "By nature this is a slow-moving matter, but the first-house setting can push it along faster than such processes usually go and show earlier visible progress. Expect gradual movement overall, with the setting doing more of the work than the matter's own pace.",
  timing_summary: "Slow by nature but externally assisted: gradual overall, with earlier visible signs than this kind of process normally gives, in the natural scale of an application.",
  watch_out: "One overlooked detail could stall an otherwise assisted matter, so confirm one missing requirement rather than assuming it is handled.",
  practical_step: "Check one specific outstanding requirement and confirm it is complete before the next review point.",
};
ok(run(timing, "timing")?.kind === "completed", "timing accepted");
eq(run({ ...timing, practical_step: null }, "timing"), null, "timing requires practical_step");
eq(run({ ...timing, judgment_code: "favourable" }, "timing"), null, "timing rejects judgment_code");
eq(run({ ...timing, suggested_followups: ["x?"] }, "timing"), null, "timing rejects followups");
eq(run({ ...timing, synthesis: "It moves with steady emotional intuition and safety. It stays gradual." }, "timing"), null, "timing rejects Level-1 leak");

// ---------- Person / thing_or_situation / reason / location ----------
const person = {
  ...base("person", "en"),
  synthesis: "Your new manager reads as a structured, responsibility-focused person who leads through standards rather than warmth. In a role of visible authority they will likely value reliability and follow-through above quick rapport.",
  watch_out: "You might read their reserve as disapproval when it is really a preference for proven consistency, so give it time before concluding.",
  practical_step: "Show one piece of dependable follow-through early and note how they respond before adjusting your approach.",
};
ok(run(person, "person")?.kind === "completed", "person accepted");
eq(run({ ...person, judgment_code: "favourable", judgment_summary: "Good." }, "person"), null, "person rejects verdict");

const location = {
  ...base("location", "en"),
  synthesis: "The missing document most likely sits in a low, stable storage spot at home rather than somewhere in transit. Think ground-level and fixed rather than high or open, and close by rather than far.",
  watch_out: "Assuming it is lost outside the home could waste your search when the indications point to a nearby low storage area.",
  practical_step: "Start with lower drawers, shelves near the floor, or a fixed storage box at home before looking further afield.",
};
ok(run(location, "location")?.kind === "completed", "location accepted (direction language allowed)");
eq(run({ ...person, watch_out: "Search to the north of the building for the answer." }, "person"), null, "location leak rejected outside location mode");

// ---------- route_review + deterministic copy ----------
eq(parseDiceV04Output(JSON.stringify({ status: "route_review_required", language: "en" }), { mode: "judgment", language: "en" })?.kind, "route_review", "route_review status parsed");
ok(presentDiceV04Deterministic("route_review", "en").message !== presentDiceV04Deterministic("bundled", "en").message, "route-review copy distinct from bundled");
ok(presentDiceV04Deterministic("bundled", "en").message !== presentDiceV04Deterministic("fallback", "en").message, "bundled copy distinct from fallback");

// ---------- Presentation ----------
const jp = presentDiceV04Result((jOut as { result: Parameters<typeof presentDiceV04Result>[0] }).result, landing);
eq(jp.sections.map((s) => s.heading).join("|"), "Result|Reading|One thing to watch|Suggested follow-up questions", "judgment sections");
ok(jp.opening.startsWith("You drew Jupiter in Sagittarius in the 1st House. "), "judgment opening line");
ok(!jp.opening.includes(jp.sections[1].body ?? ""), "opening not repeated in Reading");
ok((jp.sections[3].items?.length ?? 0) === 2, "follow-up questions rendered as items");
ok((jp.sections[0].body ?? "").startsWith("Strongly favourable"), "verdict label rendered");

const tp = presentDiceV04Result((run(timing, "timing") as { result: Parameters<typeof presentDiceV04Result>[0] }).result, { planet: "pluto", sign: "sagittarius", house: "house_1" });
eq(tp.sections.map((s) => s.heading).join("|"), "Timing|Reading|One thing to watch|Practical step", "timing sections");

const pp = presentDiceV04Result((run(person, "person") as { result: Parameters<typeof presentDiceV04Result>[0] }).result, { planet: "saturn", sign: "capricorn", house: "house_10" });
eq(pp.sections.map((s) => s.heading).join("|"), "Reading|One thing to watch|Practical step", "descriptive sections");

// ---------- zh-Hant judgment ----------
const zhJudgment = {
  ...base("judgment", "zh-Hant"),
  synthesis: "整體而言，這個選擇相當有利，尤其適合由你主動開展。木星在人馬座處於強勢，核心條件較完整，第一宮亦給你較大主導權。",
  judgment_code: "strongly_favourable",
  judgment_summary: "大致有利，並特別適合主動開展；核心能力與外在環境互相配合，但有利不等於自動完成。",
  watch_out: "木星力量較強時容易高估可承擔的範圍，不要把有利趨勢當成可以忽略基本條件的保證。",
  suggested_followups: ["出發前最需要準備的是甚麼？", "這次最大的挑戰會是甚麼？"],
};
const zjOut = run(zhJudgment, "judgment", "zh-Hant");
ok(zjOut?.kind === "completed", "zh-Hant judgment accepted");
const zjp = presentDiceV04Result((zjOut as { result: Parameters<typeof presentDiceV04Result>[0] }).result, landing);
ok(zjp.opening.startsWith("你抽到木星落在人馬座及第一宮。"), "zh opening line");
ok((zjp.sections[0].body ?? "").startsWith("大吉"), "zh verdict label 大吉");
eq(zjp.sections.map((s) => s.heading).join("|"), "結果|解讀|需要留意|建議延伸問題", "zh judgment sections");
eq(run({ ...zhJudgment, practical_step: "做一件事。" }, "judgment", "zh-Hant"), null, "zh judgment rejects practical_step");

console.log("Dice v4 (Prompt v3 spec) contract passed: 2-stage routing, 6 modes, 吉凶平 judgment + follow-ups, timing speed-only, location gating, per-mode rendering, EN/zh-Hant.");
