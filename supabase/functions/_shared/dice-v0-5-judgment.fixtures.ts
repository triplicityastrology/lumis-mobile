/** v5 Judgment fixtures — schema, parse, assembler, Appendix H equality (JG-01/Test 5). */
import { buildStage2Schema, parseDiceV05Stage2, buildLanding, DICE_V05_ROUTE_REVIEW_LITERAL, nodeDignityOk } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope, assembleJudgment } from "./dice-v0-5-presentation.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Envelope builder resolves the exact controlled fixed fields.
const envZh = buildJudgmentEnvelope("zh-Hant", "我應唔應該去Working holiday？", "jupiter", "sagittarius", 1) as any;
eq(envZh.given.landing, buildLanding("jupiter", "sagittarius", 1), "JG landing zh");
eq(envZh.given.planet_fortune, "major_benefic", "JG fortune");
eq(envZh.given.dignity, "ruler", "JG dignity");
eq(envZh.given.dignity_emphasis, "constructive", "JG emphasis (strong->constructive)");
eq(envZh.given.constructive_traits, "大方、守信、慷慨、誠實、自由、品德高尚、有智慧、有能力、有資源", "JG constructive zh");

// Provider response (Appendix H.2) validates against the zh judgment schema.
const respZh = { status: "ok",
  planet_prose: "木星是大吉星，落在自己守護的射手座，力量最強；大方、遠見及資源優勢能充分發揮。",
  house_prose: "第一宮為大吉、排行第一，環境非常有利，而且事情較掌握在自己手中。",
  synthesis: "行星與宮位兩邊都屬有利：最強的大吉星配上最吉的宮位，支持這條路；兩邊仍分開判斷，不合併成單一總分。",
  watch_out: "木星的擴張傾向可能令人過度樂觀，即使環境有利，也要控制承諾和開支。",
  suggested_followups: ["去working holiday前我應先準備甚麼？", "如果去，我的財務會怎樣發展？"] };
const parsedZh = parseDiceV05Stage2("judgment", "zh-Hant", JSON.stringify(respZh));
ok(parsedZh && parsedZh.kind === "ok", "JG-01 zh parse ok");
const finalZh = assembleJudgment("zh-Hant", buildLanding("jupiter", "sagittarius", 1), (parsedZh as any).value);
// Appendix H.2 assembled object (verbatim).
const H2 = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護（最強）", strength: "strong", constructive_traits: "大方、守信、慷慨、誠實、自由、品德高尚、有智慧、有能力、有資源", difficult_traits: "浪費、魯莽、放縱、誇張、貪婪、粗心大意", dignity_emphasis: "constructive", prose: respZh.planet_prose },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: respZh.house_prose },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: respZh.synthesis, timing_summary: null, watch_out: respZh.watch_out, practical_step: null, suggested_followups: respZh.suggested_followups };
eq(finalZh, H2, "JG-01 assembled == Appendix H.2");

// English (Appendix H.3).
const respEn = { status: "ok",
  planet_prose: "Jupiter is a major benefic in its own sign Sagittarius, operating at full strength; its generosity, vision and resources can express clearly.",
  house_prose: "House 1 is great fortune and ranked first, giving a highly supportive environment with the matter more directly in your hands.",
  synthesis: "Both fixed sides are favourable: a strong major benefic operates within the most supportive House environment. They remain two separate findings and are not averaged into one grade.",
  watch_out: "Jupiter's expansive tendency can become overconfidence, so keep promises and spending realistic even with strong support.",
  suggested_followups: ["What should I prepare before a working holiday?", "How might the move affect my finances?"] };
const parsedEn = parseDiceV05Stage2("judgment", "en", JSON.stringify(respEn));
ok(parsedEn && parsedEn.kind === "ok", "JG-01 en parse ok");
const finalEn = assembleJudgment("en", buildLanding("jupiter", "sagittarius", 1), (parsedEn as any).value);
ok(finalEn.question_mode === "judgment" && (finalEn as any).planet_side.constructive_traits === "Generous, trustworthy, honest, principled, wise, capable and resourceful", "JG-01 en fixed traits");
ok((finalEn as any).practical_step === null && Array.isArray((finalEn as any).suggested_followups), "JG practical_step null; followups present");

// Route-review literal passes only the judgment schema shape (parser RR-clean).
const rr = parseDiceV05Stage2("judgment", "en", JSON.stringify(DICE_V05_ROUTE_REVIEW_LITERAL.judgment));
ok(rr && rr.kind === "route_review", "JG route-review literal accepted");

// Node dignity rule.
ok(nodeDignityOk("north_node", null, null, "neutral"), "Node null dignity ok");
ok(!nodeDignityOk("north_node", "ruler", "守護", "neutral"), "Node non-null dignity rejected");
ok(nodeDignityOk("jupiter", "ruler", "守護（最強）", "strong"), "non-node non-null dignity ok");

// Followups count breach rejected (DICE_ARRAY_COUNT).
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...respEn, suggested_followups: ["a", "b", "c", "d"] })) === null, "JG followups length 4 rejected");
// zh synthesis over cap rejected (DICE_FIELD_LENGTH).
ok(parseDiceV05Stage2("judgment", "zh-Hant", JSON.stringify({ ...respZh, synthesis: "字".repeat(170) })) === null, "JG zh synthesis 170>165 rejected");
// practical_step is not a judgment key (extra key rejected).
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...respEn, practical_step: "x" })) === null, "JG extra key rejected");

void buildStage2Schema;
console.log("dice-v0-5 judgment fixtures passed");
