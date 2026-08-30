/** v5 Level-1 fixtures (§20.4A) — envelope + assembled equality against Appendix H.7/H.8/H.9. */
import { parseDiceV05Stage2, buildLanding } from "./dice-v0-5-interpretation-contract.ts";
import { buildLevel1Envelope, assembleLevel1 } from "./dice-v0-5-presentation.ts";
import { dignityOf, SIGN_ESSENCE, DICE_V05_SIGN_IDS, type DiceV05PlanetId, type DiceV05SignId } from "./dice-v0-5-fixed-data.ts";

declare const require: (m: string) => any;
declare const __dirname: string;
function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

type Mode = "person" | "reason" | "thing_or_situation";
type Row = { id: string; mode: Mode; lang: "en" | "zh-Hant"; planet: DiceV05PlanetId; sign: DiceV05SignId; house: number;
  envelope: string; response: string; final: string };

// Verbatim Appendix H input envelopes, provider responses, and complete final objects.
const rows: Row[] = [
  { id: "H.7 person zh", mode: "person", lang: "zh-Hant", planet: "saturn", sign: "libra", house: 10,
    envelope: `{"language":"zh-Hant","question":"我新上司係個點嘅人？","mode":"person","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"libra","sign_label_en":"Libra","sign_label_zh":"天秤座","house_number":10,"house_label_en":"House 10","house_label_zh":"第十宮"},"planet_essence":"責任、結構與耐性","planet_detail":"時間、紀律、成熟、事業根基","sign_essence":"平衡、協調關係","sign_detail":"合作、談判、美感","house_essence":"事業與名聲","house_detail":"地位、成就、上司、公眾形象","dignity_strength":"strong"}}`,
    response: `{"status":"ok","synthesis":"這位上司帶有土星的沉穩、責任感與長遠結構，透過天秤座的協調和合作方式表達，並在第十宮的事業與地位場景中展現，是一位重秩序也重關係的人。","watch_out":"他很重視程序與公平，跳過流程或只顧速度可能不討好。","practical_step":"先了解他重視的規矩和目標，再用有條理的方式提出建議。"}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"zh-Hant","question_mode":"person","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"這位上司帶有土星的沉穩、責任感與長遠結構，透過天秤座的協調和合作方式表達，並在第十宮的事業與地位場景中展現，是一位重秩序也重關係的人。","timing_summary":null,"watch_out":"他很重視程序與公平，跳過流程或只顧速度可能不討好。","practical_step":"先了解他重視的規矩和目標，再用有條理的方式提出建議。","suggested_followups":[]}` },
  { id: "H.7 person en", mode: "person", lang: "en", planet: "saturn", sign: "libra", house: 10,
    envelope: `{"language":"en","question":"What kind of person is my new manager?","mode":"person","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"libra","sign_label_en":"Libra","sign_label_zh":"天秤座","house_number":10,"house_label_en":"House 10","house_label_zh":"第十宮"},"planet_essence":"Responsibility, structure and patience","planet_detail":"Time, discipline, maturity and career foundations","sign_essence":"Balance and coordinating relationships","sign_detail":"Cooperation, negotiation, aesthetics","house_essence":"Career and reputation","house_detail":"Status, achievement, managers and public image","dignity_strength":"strong"}}`,
    response: `{"status":"ok","synthesis":"This manager combines Saturn's seriousness, responsibility and long-term structure with Libra's cooperative, balanced manner, expressed through House 10 career and status: orderly, substantial and attentive to working relationships.","watch_out":"They are likely to value procedure and fairness, so bypassing the process may create resistance.","practical_step":"Learn the standards and goals they prioritise, then present your suggestion in a structured way."}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"en","question_mode":"person","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"This manager combines Saturn's seriousness, responsibility and long-term structure with Libra's cooperative, balanced manner, expressed through House 10 career and status: orderly, substantial and attentive to working relationships.","timing_summary":null,"watch_out":"They are likely to value procedure and fairness, so bypassing the process may create resistance.","practical_step":"Learn the standards and goals they prioritise, then present your suggestion in a structured way.","suggested_followups":[]}` },
  { id: "H.8 reason zh", mode: "reason", lang: "zh-Hant", planet: "saturn", sign: "virgo", house: 6,
    envelope: `{"language":"zh-Hant","question":"點解我啲project成日停滯？","mode":"reason","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"virgo","sign_label_en":"Virgo","sign_label_zh":"處女座","house_number":6,"house_label_en":"House 6","house_label_zh":"第六宮"},"planet_essence":"責任、結構與耐性","planet_detail":"時間、紀律、成熟、事業根基","sign_essence":"細心、實際分析","sign_detail":"規劃、改善、注重細節","house_essence":"日常工作與服務","house_detail":"職責、流程、同事與日常執行","dignity_strength":"neutral"}}`,
    response: `{"status":"ok","synthesis":"象徵上，停滯來自土星對穩固結構的要求，經過處女座不斷分析和修正，再落在第六宮的日常流程中，容易變成每一步都想完善，卻遲遲未完成。","watch_out":"改善細節可能慢慢變成不交付的理由。","practical_step":"選一個項目設定足夠好的完成標準，先完成一個可交付步驟。"}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"zh-Hant","question_mode":"reason","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"象徵上，停滯來自土星對穩固結構的要求，經過處女座不斷分析和修正，再落在第六宮的日常流程中，容易變成每一步都想完善，卻遲遲未完成。","timing_summary":null,"watch_out":"改善細節可能慢慢變成不交付的理由。","practical_step":"選一個項目設定足夠好的完成標準，先完成一個可交付步驟。","suggested_followups":[]}` },
  { id: "H.8 reason en", mode: "reason", lang: "en", planet: "saturn", sign: "virgo", house: 6,
    envelope: `{"language":"en","question":"Why do my projects keep stalling?","mode":"reason","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"virgo","sign_label_en":"Virgo","sign_label_zh":"處女座","house_number":6,"house_label_en":"House 6","house_label_zh":"第六宮"},"planet_essence":"Responsibility, structure and patience","planet_detail":"Time, discipline, maturity and career foundations","sign_essence":"Care with detail — practical analysis","sign_detail":"Planning, refinement, attention to detail","house_essence":"Daily work and service","house_detail":"Duties, routines, colleagues and execution","dignity_strength":"neutral"}}`,
    response: `{"status":"ok","synthesis":"Symbolically, the stall comes from Saturn's demand for solid structure being filtered through Virgo's repeated analysis and refinement inside House 6 routines: each step is improved again instead of being completed.","watch_out":"Polishing details can quietly become the reason nothing is delivered.","practical_step":"Choose one project, set a good-enough completion standard, and finish one deliverable step."}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"en","question_mode":"reason","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"Symbolically, the stall comes from Saturn's demand for solid structure being filtered through Virgo's repeated analysis and refinement inside House 6 routines: each step is improved again instead of being completed.","timing_summary":null,"watch_out":"Polishing details can quietly become the reason nothing is delivered.","practical_step":"Choose one project, set a good-enough completion standard, and finish one deliverable step.","suggested_followups":[]}` },
  { id: "H.9 thing zh", mode: "thing_or_situation", lang: "zh-Hant", planet: "saturn", sign: "sagittarius", house: 12,
    envelope: `{"language":"zh-Hant","question":"我下一份應該搵咩類型嘅工作？","mode":"thing_or_situation","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"sagittarius","sign_label_en":"Sagittarius","sign_label_zh":"射手座","house_number":12,"house_label_en":"House 12","house_label_zh":"第十二宮"},"planet_essence":"責任、結構與耐性","planet_detail":"時間、紀律、成熟、事業根基","sign_essence":"放遠目光、探索意義","sign_detail":"樂觀、學習、遠方","house_essence":"隱蔽、私人與結束","house_detail":"幕後工作、退隱、研究與獨處","dignity_strength":"neutral"}}`,
    response: `{"status":"ok","synthesis":"適合的工作類型結合土星的穩定結構和長期責任、射手座的意義與廣闊視野，以及第十二宮的幕後或研究環境，例如有制度、可長期累積並較少站在聚光燈下的專業工作。","watch_out":"如果工作太孤立又缺乏清晰制度，進度容易失去方向。","practical_step":"列出一個同時具長期結構、意義感和幕後研究性質的領域，查找一個實際入口。"}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"zh-Hant","question_mode":"thing_or_situation","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"適合的工作類型結合土星的穩定結構和長期責任、射手座的意義與廣闊視野，以及第十二宮的幕後或研究環境，例如有制度、可長期累積並較少站在聚光燈下的專業工作。","timing_summary":null,"watch_out":"如果工作太孤立又缺乏清晰制度，進度容易失去方向。","practical_step":"列出一個同時具長期結構、意義感和幕後研究性質的領域，查找一個實際入口。","suggested_followups":[]}` },
  { id: "H.9 thing en", mode: "thing_or_situation", lang: "en", planet: "saturn", sign: "sagittarius", house: 12,
    envelope: `{"language":"en","question":"What kind of job should I look for next?","mode":"thing_or_situation","given":{"landing":{"planet_id":"saturn","planet_label_en":"Saturn","planet_label_zh":"土星","sign_id":"sagittarius","sign_label_en":"Sagittarius","sign_label_zh":"射手座","house_number":12,"house_label_en":"House 12","house_label_zh":"第十二宮"},"planet_essence":"Responsibility, structure and patience","planet_detail":"Time, discipline, maturity and career foundations","sign_essence":"Looking further — exploring meaning","sign_detail":"Optimism, learning, distant horizons","house_essence":"The hidden, private and closure","house_detail":"Behind-the-scenes work, retreat, research and solitude","dignity_strength":"neutral"}}`,
    response: `{"status":"ok","synthesis":"The suitable work combines Saturn's stable structure and long-term responsibility with Sagittarius meaning and breadth, carried through a House 12 behind-the-scenes or research setting: disciplined professional work that accumulates over time away from the spotlight.","watch_out":"A role that is isolated but lacks clear structure could drift.","practical_step":"Choose one field combining long-term structure, meaning and behind-the-scenes research, then identify one concrete entry route."}`,
    final: `{"schema":"lumis_dice_interpretation_v5","status":"ok","language":"en","question_mode":"thing_or_situation","planet_side":null,"house_side":null,"most_likely_area":null,"location_candidates":null,"location_extension":null,"location_search_order":null,"synthesis":"The suitable work combines Saturn's stable structure and long-term responsibility with Sagittarius meaning and breadth, carried through a House 12 behind-the-scenes or research setting: disciplined professional work that accumulates over time away from the spotlight.","timing_summary":null,"watch_out":"A role that is isolated but lacks clear structure could drift.","practical_step":"Choose one field combining long-term structure, meaning and behind-the-scenes research, then identify one concrete entry route.","suggested_followups":[]}` },
];

for (const r of rows) {
  const expectedEnv = JSON.parse(r.envelope) as any;
  const q = expectedEnv.question as string;
  const env = buildLevel1Envelope(r.mode, r.lang, q, r.planet, r.sign, r.house) as any;
  // dignity_strength is deterministic (dignityOf, Appendix A — "model never authors dignity").
  // Saturn-in-Virgo = peregrine ⇒ neutral (no rulership/exaltation/fall/detriment in Virgo).
  // The earlier proposal "weak" for this landing was a documentation typo, now corrected to
  // neutral in Appendix H.8 / §20.4A; the envelope therefore matches Appendix H byte-for-byte.
  eq(env.given.dignity_strength, dignityOf(r.planet, r.sign).strength, `${r.id} dignity_strength deterministic`);
  eq(env, expectedEnv, `${r.id} envelope == Appendix H`);
  eq(env.given.landing, buildLanding(r.planet, r.sign, r.house), `${r.id} landing`);
  const parsed = parseDiceV05Stage2("level1", r.lang, r.response);
  ok(parsed && parsed.kind === "ok", `${r.id} parse ok`);
  const final = assembleLevel1(r.lang, r.mode, (parsed as any).value);
  eq(final, JSON.parse(r.final), `${r.id} assembled == Appendix H final`);
}

// Level-1 must reject an element-direction leak (FORBIDDEN: element direction/place).
ok(parseDiceV05Stage2("level1", "en", JSON.stringify({ status: "ok", synthesis: "Search the north side of the room near water.", watch_out: "w", practical_step: "p" })) === null, "level1 element-direction leak rejected");
// Missing practical_step (required non-null) rejected.
ok(parseDiceV05Stage2("level1", "en", JSON.stringify({ status: "ok", synthesis: "s", watch_out: "w", practical_step: null })) === null, "level1 null practical_step rejected");
// Route-review clean literal accepted.
ok((parseDiceV05Stage2("level1", "en", JSON.stringify({ status: "route_review_required", synthesis: null, watch_out: null, practical_step: null })) as any)?.kind === "route_review", "level1 route-review accepted");

/* ---- Source check: SIGN_ESSENCE is copied VERBATIM from the approved SIGN_BANK ---- */
// Reads apps/mobile/src/features/dice/interpretationBank.ts and asserts every sign's
// essence_en/detail_en (= SIGN_BANK.essence/detail) and essence_zh/detail_zh (= the first two
// ／-separated parts of SIGN_BANK.zhRef) match SIGN_ESSENCE. No new controlled astrology is authored.
{
  const fs = require("node:fs");
  const path = require("node:path");
  const candidates = ["apps/mobile/src/features/dice/interpretationBank.ts",
    path.resolve(__dirname, "../../../../../../apps/mobile/src/features/dice/interpretationBank.ts")];
  const bankPath = candidates.find((p: string) => fs.existsSync(p));
  ok(bankPath, "interpretationBank.ts found for source check");
  const src = fs.readFileSync(bankPath as string, "utf8");
  const signBankSection = src.slice(src.indexOf("SIGN_BANK"));
  const re = /(\w+):\s*\{\s*essence:\s*"((?:[^"\\]|\\.)*)",\s*detail:\s*"((?:[^"\\]|\\.)*)",\s*watchOut:\s*"(?:[^"\\]|\\.)*",\s*zhRef:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  const bank: Record<string, { essence: string; detail: string; zhRef: string }> = {};
  for (let m = re.exec(signBankSection); m; m = re.exec(signBankSection)) bank[m[1]] = { essence: m[2], detail: m[3], zhRef: m[4] };
  for (const sign of DICE_V05_SIGN_IDS) {
    const b = bank[sign];
    ok(b, `SIGN_BANK has ${sign}`);
    const zhParts = b.zhRef.split("／");
    const expected = { essence_en: b.essence, detail_en: b.detail, essence_zh: zhParts[0], detail_zh: zhParts[1] };
    eq(SIGN_ESSENCE[sign], expected, `SIGN_ESSENCE[${sign}] == approved SIGN_BANK`);
  }
}

console.log("dice-v0-5 level1 fixtures passed");
