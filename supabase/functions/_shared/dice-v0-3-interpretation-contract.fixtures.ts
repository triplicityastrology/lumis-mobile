import {
  DICE_ROUTE_MISMATCH_COPY,
  DICE_V03_RESULT_SCHEMA,
  buildDiceV03Prompt,
  diceV03RouteMismatchEnvelope,
  parseDiceV03ModelResult,
  parseDiceV03Output,
  parseDiceV03RouteMismatch,
} from "./dice-v0-3-interpretation-contract.ts";
import { presentDiceV03Result, presentDiceV03Deterministic } from "./dice-v0-3-presentation.ts";

function ok(value: unknown, label: string): asserts value { if (!value) throw new Error(label); }
function match(value: string, pattern: RegExp, label: string): void { if (!pattern.test(value)) throw new Error(label); }
function equal(left: unknown, right: unknown, label: string): void { if (left !== right) throw new Error(label); }

const judgment = {
  fixture_id: "DICE-TECH-EN-JUDGMENT-01",
  question: "Should I ask for clarity about this relationship?",
  language: "en" as const,
  question_shape: "judgment" as const,
  outcome: { planet: "jupiter", sign: "pisces", house: "house_12" },
};
const prompt = buildDiceV03Prompt(judgment);
for (const phrase of [
  "core/internal capability",
  "external environment, independent fortune/pace/distance",
  "never average with dignity",
  "Every narrative field must directly answer fixture.question",
  "Planet core + Sign/element expression + House external environment",
  "Exactly one bounded, reversible, non-professional action",
  "No generic advice blocks",
  "Uranus in Aquarius, Neptune in Pisces and Pluto in Scorpio are ruler/strengthened",
  "DICE_ROUTE_MISMATCH",
]) match(prompt, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `prompt binds ${phrase}`);
match(prompt, /"strength":"strong"/, "dignity is selected");
match(prompt, /"fortune":"great_misfortune"/, "house environment is selected for judgment");

const enResult = {
  schema: DICE_V03_RESULT_SCHEMA,
  language: "en" as const,
  planet_layer: "Jupiter carries the core capacity for honest growth and perspective here.",
  sign_element_layer: "Pisces and Water express that capacity through empathy, receptivity, and emotional nuance.",
  house_layer: "The 12th House places the matter in a hidden external environment where assumptions can obscure what is happening.",
  synthesis: "On whether to ask for clarity here, Jupiter's honest reach works through Piscean empathy but lands in the hidden 12th House, so the wish to understand is sound while the surrounding context stays unclear. Because the capability is constructive and the environment is obscured, a specific request serves you better than a broad emotional opening.",
  timing_or_pace: null,
  judgment: "The tendency is mixed but workable: the inner capacity is constructive while the temporary environment remains unclear.",
  watch_out: "Reading hidden meaning into silence can turn a genuine question into an accusation the other person never actually heard.",
  practical_direction: "Ask one calm, specific question and give the other person room to answer before adding a second concern.",
};
const parsedEn = parseDiceV03ModelResult(JSON.stringify(enResult), judgment);
ok(parsedEn, "question-specific judgment result accepted");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, practical_direction: "Trust your intuition." }), judgment), null, "generic advice block rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, watch_out: "One risk is overusing Pisces's mode of expression." }), judgment), null, "placeholder filler watch-out rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, planet_layer: "木星代表成長。" }), judgment), null, "mixed language rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, synthesis: enResult.planet_layer + " " + enResult.sign_element_layer }), judgment), null, "synthesis that pastes a layer verbatim rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, synthesis: "One integrated sentence only." }), judgment), null, "single-sentence synthesis rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, extra_field: "schema drift" }), judgment), null, "unknown field rejected");
equal(parseDiceV03ModelResult(JSON.stringify(((): unknown => { const { watch_out, ...rest } = enResult; return rest; })()), judgment), null, "missing watch_out rejected");

const enPresentation = presentDiceV03Result(parsedEn, judgment);
match(enPresentation.opening, /^You drew Jupiter in Pisces in the 12th House\. /u, "AC-DICE-09 English opening = id line + first synthesis sentence");
equal(enPresentation.sections.map(({ heading }) => heading).join("|"), "Reading|One thing to watch|Practical step", "AC-DICE-09 English sections");
ok(!enPresentation.opening.includes(enPresentation.sections[0].body), "opening does not repeat the Reading");
ok(enResult.synthesis.includes(enPresentation.sections[0].body), "Reading is the remaining synthesis");
equal(enPresentation.sections[1].body, enResult.watch_out, "watch-out is the model field, not a template");
equal(enPresentation.sections[2].body, enResult.practical_direction, "one action only");

const descriptive = { ...judgment, fixture_id: "DICE-TECH-EN-DESCRIPTIVE-01", question: "What is shaping my current work situation?", question_shape: "descriptive" as const, outcome: { planet: "saturn", sign: "capricorn", house: "house_10" } };
const descriptiveResult = {
  ...enResult,
  planet_layer: "Saturn centers responsibility, structure, and sustained effort for this work question.",
  sign_element_layer: "Capricorn and Earth express this through discipline, planning, and tangible standards.",
  house_layer: "The 10th House places the matter in the visible external environment of career, responsibility, and recognition.",
  synthesis: "Your current work situation is shaped by Saturn's push for structure, carried out through Capricorn's disciplined planning and landing in the public 10th House of career. The picture is descriptive rather than a verdict: steady effort is being tested by visible expectations rather than by any single obstacle.",
  judgment: null,
  watch_out: "Treating every visible expectation as urgent can crowd out the slower, structural work that actually moves your standing.",
  practical_direction: "Choose one visible responsibility, define its completion standard, and finish that before taking on another.",
};
ok(parseDiceV03ModelResult(JSON.stringify(descriptiveResult), descriptive), "descriptive synthesis accepted without verdict");
equal(parseDiceV03ModelResult(JSON.stringify({ ...descriptiveResult, judgment: "This is favourable." }), descriptive), null, "descriptive route rejects a verdict field");

const timing = { ...judgment, fixture_id: "DICE-TECH-ZH-TIMING-01", question: "我個申請幾時會有進展？", language: "zh-Hant" as const, question_shape: "timing" as const, outcome: { planet: "jupiter", sign: "gemini", house: "house_9" } };
const zhResult = {
  schema: DICE_V03_RESULT_SCHEMA,
  language: "zh-Hant" as const,
  planet_layer: "就這個申請問題而言，木星把核心放在擴展、資源與較長的發展過程。",
  sign_element_layer: "雙子座與風元素透過文件、訊息和清楚溝通來推進事情。",
  house_layer: "第九宮把事情放在海外、進修或制度程序的外在環境，距離較遠，節奏亦較慢。",
  synthesis: "整體而言，這個申請的節奏偏慢：木星帶來較長的發展過程，透過雙子座的文件與溝通逐步推進，卻落在第九宮這個距離較遠的外在環境。可先預期以數星期至數月為單位的進展，訊息或文件往來可能較快，而正式結果會較慢。",
  timing_or_pace: "這屬於以數星期至數月衡量的相對慢節奏，並不是承諾某個日期或結果。",
  judgment: null,
  watch_out: "把每次沉默都解讀為壞消息，容易讓漫長的等待變成不必要的焦慮來源。",
  practical_direction: "整理一份文件清單，確認缺漏後，以一次簡短而具體的訊息查詢下一個程序節點。",
};
const parsedZh = parseDiceV03ModelResult(JSON.stringify(zhResult), timing);
ok(parsedZh, "written Traditional Chinese timing result accepted");
equal(parseDiceV03ModelResult(JSON.stringify({ ...zhResult, practical_direction: "呢個做法唔得。" }), timing), null, "Cantonese output rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...zhResult, timing_or_pace: "批核時間是 12/10。" }), timing), null, "promised date rejected");
const zhPresentation = presentDiceV03Result(parsedZh, timing);
match(zhPresentation.opening, /^你抽到木星落在雙子座及第九宮。/u, "AC-DICE-09 zh-Hant opening");
equal(zhPresentation.sections.map(({ heading }) => heading).join("|"), "解讀|需要留意|實際一步", "AC-DICE-09 zh-Hant sections");
ok(!zhPresentation.opening.includes(zhPresentation.sections[0].body), "zh opening does not repeat the Reading");

// Standardized route-mismatch envelope: prompt, validator and gateway agree.
const mismatchRaw = JSON.stringify(diceV03RouteMismatchEnvelope("en"));
const mismatchOut = parseDiceV03Output(mismatchRaw, { language: "en", question_shape: "timing" });
ok(mismatchOut?.kind === "route_mismatch", "route-mismatch envelope parsed by shared validator");
equal(parseDiceV03RouteMismatch(JSON.stringify({ result: "route_mismatch", code: "DICE_ROUTE_MISMATCH", language: "zh-Hant" }), "en"), null, "route-mismatch language must match expected");
const completedOut = parseDiceV03Output(JSON.stringify(enResult), judgment);
ok(completedOut?.kind === "completed", "completed result parsed by shared validator");

// Deterministic copy is distinct across the three non-normal kinds.
equal(presentDiceV03Deterministic("route_mismatch", "en").message, DICE_ROUTE_MISMATCH_COPY.en, "route-mismatch copy is the approved string");
ok(presentDiceV03Deterministic("route_mismatch", "en").message !== presentDiceV03Deterministic("fallback", "en").message, "route-mismatch copy differs from technical fallback");
ok(presentDiceV03Deterministic("route_mismatch", "zh-Hant").message !== presentDiceV03Deterministic("safety", "zh-Hant").message, "route-mismatch copy differs from safety copy");

console.log("Dice v0.3 (v3) quality contract passed: synthesis Reading, model watch-out, opening dedup, route-mismatch envelope, EN/zh-Hant.");
