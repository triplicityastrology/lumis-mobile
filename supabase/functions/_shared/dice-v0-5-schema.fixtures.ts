/** v5 Schema fixtures — buildStage2Schema shapes/caps, landing identity, route-review
 * mode-specificity, and the §12.4 final-object key contract. */
import {
  buildStage2Schema, diceV05LandingSchema, validateLandingIdentity, buildLanding,
  parseDiceV05Stage2, DICE_V05_ROUTE_REVIEW_LITERAL, CAPS,
} from "./dice-v0-5-interpretation-contract.ts";
import {
  assembleJudgment, assembleTiming, assembleLocation, assembleLevel1, assembleRouteReview, buildLocationResolution,
} from "./dice-v0-5-presentation.ts";
import { DICE_V05_RESULT_SCHEMA } from "./dice-v0-5-fixed-data.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }
const keys = (o: any) => Object.keys(o).sort();

/* ---- Stage-2 strict schemas: closed, exact required keys, caps wired by language ---- */
for (const lang of ["en", "zh-Hant"] as const) {
  const j: any = buildStage2Schema("judgment", lang);
  eq(j.additionalProperties, false, `judgment/${lang} closed`);
  eq(keys(j.properties), ["house_prose", "planet_prose", "status", "suggested_followups", "synthesis", "watch_out"], `judgment/${lang} keys`);
  eq(j.properties.synthesis.anyOf[0].maxLength, CAPS.judgment[lang].syn, `judgment/${lang} synthesis cap`);
  eq(j.properties.suggested_followups.items.maxLength, CAPS.judgment[lang].follow, `judgment/${lang} follow cap`);

  const t: any = buildStage2Schema("timing", lang);
  eq(keys(t.properties), ["status", "synthesis", "timing_summary", "watch_out"], `timing/${lang} keys`);
  eq(t.properties.timing_summary.anyOf[0].maxLength, CAPS.timing[lang].ts, `timing/${lang} ts cap`);

  const l: any = buildStage2Schema("location", lang);
  eq(keys(l.properties), ["extension", "location_candidates", "most_likely_area", "practical_step", "search_order", "status", "synthesis", "watch_out"], `location/${lang} keys`);
  // Evidence arrays: 0–2 unique keys.
  const evP = l.properties.location_candidates.anyOf[0].items.properties.evidence.properties.p;
  eq([evP.minItems, evP.maxItems, evP.uniqueItems], [0, 2, true], `location/${lang} evidence array bounds`);
  eq(l.properties.location_candidates.anyOf[0].maxItems, 4, `location/${lang} 2–4 candidates max`);
  eq(l.properties.location_candidates.anyOf[0].minItems, 2, `location/${lang} 2–4 candidates min`);
  eq(l.properties.extension.anyOf[0].properties.relationship.maxLength, CAPS.location[lang].ext, `location/${lang} extension cap`);

  const v: any = buildStage2Schema("level1", lang);
  eq(keys(v.properties), ["practical_step", "status", "synthesis", "watch_out"], `level1/${lang} keys`);
  eq(v.properties.synthesis.anyOf[0].maxLength, CAPS.level1[lang].syn, `level1/${lang} synthesis cap`);
}

/* ---- §12.0 landing identity validator ---- */
const landing = buildLanding("jupiter", "sagittarius", 1);
ok(validateLandingIdentity(landing, { planet: "jupiter", sign: "sagittarius", house: 1 }), "landing identity valid");
ok(!validateLandingIdentity(landing, { planet: "saturn", sign: "sagittarius", house: 1 }), "landing planet mismatch");
ok(!validateLandingIdentity(landing, { planet: "jupiter", sign: "leo", house: 1 }), "landing sign mismatch");
ok(!validateLandingIdentity(landing, { planet: "jupiter", sign: "sagittarius", house: 2 }), "landing house mismatch");
ok(!validateLandingIdentity({ ...landing, planet_label_en: "Saturn" }, { planet: "jupiter", sign: "sagittarius", house: 1 }), "landing label tampered");
const ls: any = diceV05LandingSchema();
eq(ls.additionalProperties, false, "landing schema closed");
eq(ls.required.length, 9, "landing schema 9 required");

/* ---- Route-review literals are mode-specific: a judgment RR literal must NOT parse as another mode ---- */
ok((parseDiceV05Stage2("judgment", "en", JSON.stringify(DICE_V05_ROUTE_REVIEW_LITERAL.judgment)) as any)?.kind === "route_review", "judgment RR literal parses as judgment");
ok(parseDiceV05Stage2("timing", "en", JSON.stringify(DICE_V05_ROUTE_REVIEW_LITERAL.judgment)) === null, "judgment RR literal rejected under timing (wrong keys)");
ok(parseDiceV05Stage2("location", "en", JSON.stringify(DICE_V05_ROUTE_REVIEW_LITERAL.judgment)) === null, "judgment RR literal rejected under location");
// A judgment RR literal with a non-empty followups array is not RR-clean.
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...DICE_V05_ROUTE_REVIEW_LITERAL.judgment, suggested_followups: ["x"] })) === null, "RR-unclean followups rejected");
// A judgment RR literal with a non-null content field is not RR-clean.
ok(parseDiceV05Stage2("judgment", "en", JSON.stringify({ ...DICE_V05_ROUTE_REVIEW_LITERAL.judgment, synthesis: "x" })) === null, "RR-unclean synthesis rejected");

/* ---- §12.4 final assembled object: exact required key set for every mode ---- */
const FINAL_KEYS = ["schema", "status", "language", "question_mode", "planet_side", "house_side", "most_likely_area",
  "location_candidates", "location_extension", "location_search_order", "synthesis", "timing_summary", "watch_out", "practical_step", "suggested_followups"].sort();
const jv = { planet_prose: "p", house_prose: "h", synthesis: "s", watch_out: "w", suggested_followups: ["a"] };
const finals: Record<string, any> = {
  judgment: assembleJudgment("en", landing, jv),
  timing: assembleTiming("en", landing, { timing_summary: "t", synthesis: "s", watch_out: null }),
  level1: assembleLevel1("en", "person", { synthesis: "s", watch_out: "w", practical_step: "p" }),
  route_review: assembleRouteReview("en", "judgment"),
};
{
  const res = buildLocationResolution("en", "moon", "leo", 4);
  finals.location = assembleLocation("en", { most_likely_area: "a", synthesis: "s", watch_out: "w", practical_step: "p",
    location_candidates: [{ rank: 1, place: "x", evidence: { p: ["p1"], h: [], e: [] } }, { rank: 2, place: "y", evidence: { p: ["p2"], h: [], e: [] } }],
    extension: null, search_order: [1, 2] }, res.gid);
}
for (const [mode, f] of Object.entries(finals)) {
  eq(keys(f), FINAL_KEYS, `final ${mode} key contract`);
  eq(f.schema, DICE_V05_RESULT_SCHEMA, `final ${mode} schema id`);
}
eq(finals.route_review.status, "route_review_required", "route-review final status");
eq(finals.judgment.status, "ok", "judgment final status ok");

/* ---- SC-18 / SC-19 parser leak heuristics ---- */
// SC-18: a timing output containing a concrete date is rejected; a bare pace band passes.
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "Expect it around March next year.", synthesis: "The process runs at a medium pace overall.", watch_out: null })) === null, "SC-18 timing date leak rejected");
ok(parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "Expect it within 3 weeks.", synthesis: "The pace is fast overall.", watch_out: null })) === null, "SC-18 timing numeric duration rejected");
ok((parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "It should arrive at a medium pace, sooner than a slow matter.", synthesis: "House speed lifts an otherwise slow planet into the medium band.", watch_out: null })) as any)?.kind === "ok", "SC-18 relative-pace timing accepted");
// "may" as a modal verb must NOT trip the date leak.
ok((parseDiceV05Stage2("timing", "en", JSON.stringify({ status: "ok", timing_summary: "It may move at a fast pace.", synthesis: "The immediate environment is quick, so the matter resolves fast.", watch_out: null })) as any)?.kind === "ok", "SC-18 modal 'may' not a date");
// SC-19: a location output containing a dignity/fortune word is rejected.
const locOk = { status: "ok", most_likely_area: "at home", synthesis: "Home first, then the heat side.",
  location_candidates: [{ rank: 1, place: "the bedroom", evidence: { p: ["p1"], h: [], e: [] } }, { rank: 2, place: "the kitchen", evidence: { p: ["p2"], h: [], e: [] } }],
  extension: null, search_order: [1, 2], watch_out: "Do not check only the obvious spots.", practical_step: "Start with the bedroom." };
ok((parseDiceV05Stage2("location", "en", JSON.stringify(locOk)) as any)?.kind === "ok", "SC-19 clean location accepted");
ok(parseDiceV05Stage2("location", "en", JSON.stringify({ ...locOk, synthesis: "This is a benefic, fortunate placement pointing home." })) === null, "SC-19 location dignity/fortune word rejected");

console.log("dice-v0-5 schema fixtures passed");
