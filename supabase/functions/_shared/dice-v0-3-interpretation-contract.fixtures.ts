import { DICE_V03_RESULT_SCHEMA, buildDiceV03Prompt, parseDiceV03ModelResult } from "./dice-v0-3-interpretation-contract.ts";
import { presentDiceV03Result } from "./dice-v0-3-presentation.ts";

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
]) match(prompt, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `prompt binds ${phrase}`);
match(prompt, /"strength":"strong"/, "dignity is selected");
match(prompt, /"fortune":"great_misfortune"/, "house environment is selected");

const enResult = {
  schema: DICE_V03_RESULT_SCHEMA,
  language: "en" as const,
  planet_layer: "For this relationship question, Jupiter carries the core capacity for honest growth and perspective.",
  sign_element_layer: "Pisces and Water express that capacity through empathy, receptivity, and emotional nuance.",
  house_layer: "The 12th House places the matter in a hidden external environment where assumptions can obscure what is happening.",
  timing_or_pace: null,
  judgment: "The tendency is mixed but workable: the inner capacity is constructive while the temporary environment remains unclear.",
  practical_direction: "Ask one calm, specific question and give the other person room to answer before adding a second concern.",
};
const parsedEn = parseDiceV03ModelResult(JSON.stringify(enResult), judgment);
ok(parsedEn, "question-specific judgment result accepted");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, practical_direction: "Trust your intuition." }), judgment), null, "generic advice block rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, planet_layer: "木星代表成長。" }), judgment), null, "mixed language rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...enResult, extra_field: "schema drift" }), judgment), null, "v2 unknown field rejected");

const enPresentation = presentDiceV03Result(parsedEn, judgment);
match(enPresentation.opening, /^You drew Jupiter in Pisces in the 12th House —/u, "AC-DICE-09 English opening");
equal(enPresentation.sections.map(({ heading }) => heading).join("|"), "Reading|One thing to watch|Practical step", "AC-DICE-09 English sections");
match(enPresentation.sections[0].body, /Should I ask for clarity about this relationship\?/u, "reading explicitly references question");
match(enPresentation.sections[0].body, /Jupiter.*Pisces.*12th House/u, "reading synthesizes Planet, Sign, and House");
match(enPresentation.sections[1].body, /Pisces.*amplifying this external risk.*Something is tucked away/u, "one synthesized controlled risk only");
equal(enPresentation.sections[2].body, enResult.practical_direction, "one action only");

const descriptive = { ...judgment, fixture_id: "DICE-TECH-EN-DESCRIPTIVE-01", question: "What is shaping my current work situation?", question_shape: "descriptive" as const, outcome: { planet: "saturn", sign: "capricorn", house: "house_10" } };
const descriptiveResult = { ...enResult, planet_layer: "For this work question, Saturn centers responsibility, structure, and sustained effort.", sign_element_layer: "Capricorn and Earth express this through discipline, planning, and tangible standards.", house_layer: "The 10th House places the matter in the visible external environment of career, responsibility, and recognition.", judgment: null, practical_direction: "Choose one visible responsibility, define its completion standard, and finish that before taking on another." };
ok(parseDiceV03ModelResult(JSON.stringify(descriptiveResult), descriptive), "descriptive synthesis accepted without verdict");

const timing = { ...judgment, fixture_id: "DICE-TECH-ZH-TIMING-01", question: "我個申請幾時會有進展？", language: "zh-Hant" as const, question_shape: "timing" as const, outcome: { planet: "jupiter", sign: "gemini", house: "house_9" } };
const zhResult = {
  schema: DICE_V03_RESULT_SCHEMA,
  language: "zh-Hant" as const,
  planet_layer: "就這個申請問題而言，木星把核心放在擴展、資源與較長的發展過程。",
  sign_element_layer: "雙子座與風元素透過文件、訊息和清楚溝通來推進事情。",
  house_layer: "第九宮把事情放在海外、進修或制度程序的外在環境，距離較遠，節奏亦較慢。",
  timing_or_pace: "這屬於以數星期至數月衡量的相對慢節奏，並不是承諾某個日期或結果。",
  judgment: null,
  practical_direction: "整理一份文件清單，確認缺漏後，以一次簡短而具體的訊息查詢下一個程序節點。",
};
const parsedZh = parseDiceV03ModelResult(JSON.stringify(zhResult), timing);
ok(parsedZh, "written Traditional Chinese timing result accepted");
equal(parseDiceV03ModelResult(JSON.stringify({ ...zhResult, practical_direction: "呢個做法唔得" }), timing), null, "Cantonese output rejected");
equal(parseDiceV03ModelResult(JSON.stringify({ ...zhResult, timing_or_pace: "批核時間是 12/10。" }), timing), null, "promised date rejected");
const zhPresentation = presentDiceV03Result(parsedZh, timing);
match(zhPresentation.opening, /^你抽到木星落在雙子座及第九宮/u, "AC-DICE-09 zh-Hant opening");
equal(zhPresentation.sections.map(({ heading }) => heading).join("|"), "解讀|需要留意|實際一步", "AC-DICE-09 zh-Hant sections");
match(zhPresentation.sections[0].body, /我個申請幾時會有進展？/u, "zh-Hant reading explicitly references question");

console.log("Dice v0.3 quality contract passed: question-specific synthesis, AC-DICE-09, EN/zh-Hant, relative timing, one risk/action.");
