/** v5 Judgment fixtures — schema, parse, assembler, Appendix H equality (JG-01/Test 5). */
import { buildStage2Schema, parseDiceV05Stage2, buildLanding, DICE_V05_ROUTE_REVIEW_LITERAL, nodeDignityOk } from "./dice-v0-5-interpretation-contract.ts";
import { buildJudgmentEnvelope, assembleJudgment } from "./dice-v0-5-presentation.ts";
import { PLANET_TABLE, HOUSE_TABLE, dignityOf, type DiceV05PlanetId, type DiceV05SignId } from "./dice-v0-5-fixed-data.ts";

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

// DICE_JUDGMENT_BLENDED_GRADE — an averaged / single overall grade is rejected.
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...respEn, synthesis: "The overall grade is favourable — the two sides average into one positive verdict." })) === null, "JG blended 'overall grade' rejected");
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...respEn, synthesis: "Combined, this rates mixed_neutral." })) === null, "JG v4 machine grade code rejected");
ok(parseDiceV05Stage2("judgment", "zh-Hant", JSON.stringify({ ...respZh, synthesis: "兩邊平均後，整體評分為吉，是一個綜合結論。" })) === null, "JG zh 整體評分 rejected");
// Controls: the compliant Appendix-H answers (which legitimately say "both sides are
// favourable" / "never merged into a single grade" / "不合併成單一總分") still PASS.
ok((parseDiceV05Stage2("judgment", "en", JSON.stringify(respEn)) as any)?.kind === "ok", "JG control: H.3 en (says 'favourable'/'single grade') accepted");
ok((parseDiceV05Stage2("judgment", "zh-Hant", JSON.stringify(respZh)) as any)?.kind === "ok", "JG control: H.2 zh ('不合併成單一總分') accepted");
// Structural safeguard: an added overall-grade field is rejected by the closed schema.
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...respEn, overall_grade: "favourable" })) === null, "JG extra overall_grade field rejected (closed schema)");

/* ---- §20.2 the 10 Judgment contrast rows (JG-01..JG-10): assembler injects the exact
 * fixed planet_side / house_side from the controlled tables for every landing. ---- */
type JG = { id: string; planet: DiceV05PlanetId; sign: DiceV05SignId; house: number;
  fortune: string; dignity: string | null; strength: string; emphasis: string; house_fortune: string; rank: number };
const jgRows: JG[] = [
  { id: "JG-01", planet: "jupiter", sign: "sagittarius", house: 1, fortune: "major_benefic", dignity: "ruler", strength: "strong", emphasis: "constructive", house_fortune: "great_fortune", rank: 1 },
  { id: "JG-02", planet: "venus", sign: "taurus", house: 2, fortune: "minor_benefic", dignity: "ruler", strength: "strong", emphasis: "constructive", house_fortune: "misfortune", rank: 9 },
  { id: "JG-03", planet: "saturn", sign: "capricorn", house: 10, fortune: "major_malefic", dignity: "ruler", strength: "strong", emphasis: "constructive", house_fortune: "great_fortune", rank: 2 },
  { id: "JG-04", planet: "jupiter", sign: "capricorn", house: 12, fortune: "major_benefic", dignity: "fall", strength: "weak", emphasis: "difficult", house_fortune: "great_misfortune", rank: 12 },
  { id: "JG-05", planet: "mars", sign: "cancer", house: 4, fortune: "minor_malefic", dignity: "fall", strength: "weak", emphasis: "difficult", house_fortune: "great_fortune", rank: 4 },
  { id: "JG-06", planet: "sun", sign: "leo", house: 5, fortune: "neutral", dignity: "ruler", strength: "strong", emphasis: "constructive", house_fortune: "fortune", rank: 6 },
  { id: "JG-07", planet: "uranus", sign: "aquarius", house: 11, fortune: "outer", dignity: "ruler", strength: "strong", emphasis: "constructive", house_fortune: "fortune", rank: 5 },
  { id: "JG-08", planet: "neptune", sign: "leo", house: 8, fortune: "outer", dignity: "peregrine", strength: "neutral", emphasis: "balanced", house_fortune: "misfortune", rank: 10 },
  { id: "JG-09", planet: "north_node", sign: "gemini", house: 3, fortune: "benefic_node", dignity: null, strength: "neutral", emphasis: "balanced", house_fortune: "fortune", rank: 8 },
  { id: "JG-10", planet: "south_node", sign: "gemini", house: 6, fortune: "malefic_node", dignity: null, strength: "neutral", emphasis: "balanced", house_fortune: "great_misfortune", rank: 11 },
];
const minJv = { planet_prose: "p", house_prose: "h", synthesis: "s", watch_out: "w", suggested_followups: ["a"] };
for (const r of jgRows) {
  // Fixed-data resolution matches the row.
  eq(PLANET_TABLE[r.planet].fortune, r.fortune, `${r.id} planet fortune`);
  const d = dignityOf(r.planet, r.sign);
  eq(d.dignity, r.dignity, `${r.id} dignity`);
  eq(d.strength, r.strength, `${r.id} strength`);
  eq(HOUSE_TABLE[r.house].fortune, r.house_fortune, `${r.id} house fortune`);
  eq(HOUSE_TABLE[r.house].rank, r.rank, `${r.id} house rank`);
  // Assembler injects those exact fixed values into planet_side / house_side.
  const f: any = assembleJudgment("en", buildLanding(r.planet, r.sign, r.house), minJv);
  eq(f.planet_side.fortune, r.fortune, `${r.id} planet_side.fortune injected`);
  eq(f.planet_side.dignity, r.dignity, `${r.id} planet_side.dignity injected`);
  eq(f.planet_side.strength, r.strength, `${r.id} planet_side.strength injected`);
  eq(f.planet_side.dignity_emphasis, r.emphasis, `${r.id} dignity_emphasis`);
  eq(f.house_side.fortune, r.house_fortune, `${r.id} house_side.fortune injected`);
  eq(f.house_side.rank, r.rank, `${r.id} house_side.rank injected`);
  // Node rule: dignity null ⇒ nodeDignityOk holds for null; a non-null dignity for a Node is invalid.
  if (r.dignity === null) { ok(nodeDignityOk(r.planet, null, null, "neutral"), `${r.id} node null dignity ok`); ok(!nodeDignityOk(r.planet, "ruler", "x", "neutral"), `${r.id} node non-null dignity invalid`); }
  // No practical_step, no blended grade (final has neither field / is null).
  ok(f.practical_step === null && f.timing_summary === null && f.most_likely_area === null, `${r.id} judgment nulls`);
}

void buildStage2Schema;
console.log("dice-v0-5 judgment fixtures passed");
