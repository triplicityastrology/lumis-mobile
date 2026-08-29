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

console.log("dice-v0-5 timing fixtures passed");
