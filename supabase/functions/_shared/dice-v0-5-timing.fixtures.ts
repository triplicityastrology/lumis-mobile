/** v5 Timing fixtures — v5 matrix (Founder Decision A), parse, assembler, Appendix H.4/H.5. */
import { combinedPaceV05, dignityOf } from "./dice-v0-5-fixed-data.ts";
import { parseDiceV05Stage2, buildLanding } from "./dice-v0-5-interpretation-contract.ts";
import { buildTimingEnvelope, assembleTiming } from "./dice-v0-5-presentation.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Founder Decision A: Pluto slowest × House-1 fast = medium; Moon fastest × fast = fast.
eq(combinedPaceV05("slowest", "fast"), "medium", "Test 7: slowest x fast = medium");
eq(combinedPaceV05("fastest", "fast"), "fast", "Test 8: fastest x fast = fast");
// Spot-check the rest of the matrix row-by-row.
eq(combinedPaceV05("slow", "fast"), "medium", "slow x fast = medium");
eq(combinedPaceV05("medium", "slow"), "slow", "medium x slow = slow");
eq(combinedPaceV05("fast", "medium"), "medium", "fast x medium = medium");

// Timing envelope carries the supplied dignity (neutral for Pluto/Sagittarius).
const env7 = buildTimingEnvelope("en", "When will my application be approved?", "pluto", "sagittarius", 1) as any;
eq(env7.given.combined_pace, "medium", "env Test7 combined_pace medium");
eq(env7.given.dignity, dignityOf("pluto", "sagittarius").dignity, "env Test7 dignity resolved");
eq(env7.given.dignity_strength, "neutral", "env Test7 dignity_strength neutral");

// Appendix H.4 English Test 7 → parse + assemble equality.
const resp7En = { status: "ok",
  timing_summary: "The underlying process is extremely slow, but the immediate environment accelerates it, bringing the overall pace into the medium range.",
  synthesis: "Pluto supplies the extremely slow inherent pace. House 1 supplies a fast, immediate environment and greater ability to move the matter forward. That environment accelerates the process without erasing Pluto's natural slowness, so the fixed result is medium rather than fast or slow. The supplied neutral dignity affects smoothness only and does not change the band.",
  watch_out: null };
const parsed7 = parseDiceV05Stage2("timing", "en", JSON.stringify(resp7En));
ok(parsed7 && parsed7.kind === "ok", "Test7 en parse ok");
const final7 = assembleTiming("en", buildLanding("pluto", "sagittarius", 1), (parsed7 as any).value);
const H4en = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "timing",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: resp7En.synthesis, timing_summary: resp7En.timing_summary, watch_out: null, practical_step: null, suggested_followups: [] };
eq(final7, H4en, "Test7 en assembled == Appendix H.4");

// Appendix H.5 zh Test 8.
const resp8Zh = { status: "ok",
  timing_summary: "結果應該較快出現，整體屬快速進程。",
  synthesis: "月亮提供最快的內在速度，第一宮亦提供快速而直接的環境，兩者共同形成快速結果。射手座對月亮沒有特殊尊貴，只作一般順暢度處理，不改變速度。", watch_out: null };
const parsed8 = parseDiceV05Stage2("timing", "zh-Hant", JSON.stringify(resp8Zh));
ok(parsed8 && parsed8.kind === "ok", "Test8 zh parse ok");
ok(assembleTiming("zh-Hant", buildLanding("moon", "sagittarius", 1), (parsed8 as any).value).timing_summary === resp8Zh.timing_summary, "Test8 zh assembled");

// Timing must reject a Level-1 leak (secondary heuristic).
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "It transforms emotion into rebirth.", synthesis: "The emotion here means transformation and rebirth of the psyche over time.", watch_out: null })) === null, "Timing Level-1 leak rejected");
// watch_out nullable, but if present must be capped.
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ ...resp7En, watch_out: "x".repeat(200) })) === null, "Timing watch_out 200>190 rejected");

// TM-02b — a band-only answer (no two-component explanation) is rejected.
ok(parseDiceV05Stage2("timing", "zh-Hant", JSON.stringify({ status: "ok", timing_summary: "中等", synthesis: "中等", watch_out: null })) === null, "TM-02b zh band-only rejected");
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "Medium.", synthesis: "Medium.", watch_out: null })) === null, "TM-02b en band-only rejected");
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "Medium pace", synthesis: "It is medium overall.", watch_out: null })) === null, "TM-02b thin explanation rejected");
// The valid two-component Test 7 answer still passes (control).
ok((parseDiceV05Stage2("timing", "en", JSON.stringify(resp7En)) as any)?.kind === "ok", "TM-02b control: full explanation accepted");
// A short-but-genuine zh two-component explanation (Test 8) still passes.
ok((parseDiceV05Stage2("timing", "zh-Hant", JSON.stringify(resp8Zh)) as any)?.kind === "ok", "TM-02b control: zh Test 8 accepted");

/* ---- §20.3 / §6.5 the COMPLETE 15-cell v5 combined-pace matrix ---- */
const MATRIX: Record<string, Record<string, string>> = {
  fastest: { fast: "fast", medium: "fast", slow: "medium" },
  fast: { fast: "fast", medium: "medium", slow: "medium" },
  medium: { fast: "medium", medium: "medium", slow: "slow" },
  slow: { fast: "medium", medium: "slow", slow: "slow" },
  slowest: { fast: "medium", medium: "slow", slow: "slow" }, // slowest×fast = medium (Founder Decision A)
};
for (const ps of Object.keys(MATRIX)) for (const hs of Object.keys(MATRIX[ps])) {
  eq(combinedPaceV05(ps as any, hs as any), MATRIX[ps][hs], `matrix ${ps} × ${hs}`);
}
// TM-08 (reviewer item 5b) — dignity changes SMOOTHNESS/FRICTION only, never the timing band.
// Jupiter in Sagittarius (ruler, STRONG) vs Jupiter in Gemini (detriment, WEAK): the SAME planet
// (same inherent speed) in the SAME house (same environmental speed), so the combined band is
// identical; only dignity_strength differs. This is a real same-speed contrast, not two calls to
// the pace function with identical arguments.
const tm08a = buildTimingEnvelope("en", "When will it happen?", "jupiter", "sagittarius", 1) as any;
const tm08b = buildTimingEnvelope("en", "When will it happen?", "jupiter", "gemini", 1) as any;
eq(tm08a.given.planet_speed, tm08b.given.planet_speed, "TM-08 same planet speed (Jupiter)");
eq(tm08a.given.house_speed, tm08b.given.house_speed, "TM-08 same house speed (House 1)");
eq(tm08a.given.combined_pace, tm08b.given.combined_pace, "TM-08 identical timing band (medium) regardless of dignity");
ok(dignityOf("jupiter", "sagittarius").strength === "strong" && dignityOf("jupiter", "gemini").strength === "weak", "TM-08 Jupiter dignity differs: Sagittarius=strong (ruler) vs Gemini=weak (detriment)");
ok(tm08a.given.dignity_strength === "strong" && tm08b.given.dignity_strength === "weak", "TM-08 envelope carries the differing dignity_strength (smoothness/friction qualifier)");
ok(tm08a.given.combined_pace === tm08b.given.combined_pace && tm08a.given.dignity_strength !== tm08b.given.dignity_strength, "TM-08 the band is the ONLY thing unchanged; dignity_strength is the only difference");

console.log("dice-v0-5 timing fixtures passed");
