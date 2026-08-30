/** v5 Location fixtures — validateLocation (§16, 12 cases), semantic-id gid expansion, assembler. */
import { parseDiceV05Stage2, validateLocation, type LocationResponse, type LocationSelectedKeys } from "./dice-v0-5-interpretation-contract.ts";
import { buildLocationResolution, assembleLocation } from "./dice-v0-5-presentation.ts";
import { DICE_V05_PLANET_IDS, DICE_V05_SIGN_IDS, LOCATION_PLANET_BANK, LOCATION_HOUSE_BANK, ELEMENT_TABLE, SIGN_ELEMENT } from "./dice-v0-5-fixed-data.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Moon / Leo (Fire) / House 4 — the controlled selected key set (stable semantic ids).
const res = buildLocationResolution("en", "moon", "leo", 4);
const sel: LocationSelectedKeys = res.selectedKeys;
// Real keys derived from the resolution (sel.p = [p.theme, p.context, ...related]; sel.e = element places).
const P1 = sel.p[2], P2 = sel.p[3], P3 = sel.p[4];   // three distinct planet related keys
const H1 = sel.h[2], H2 = sel.h[3], H3 = sel.h[4];   // three distinct house related keys
const E1 = sel.e[0];                                  // an element key
ok(P1.startsWith("p_") && H1.startsWith("h_") && E1.startsWith("e_"), "semantic keys present");
ok(!sel.p.includes("p_nope"), "unselected key truly absent");

const cand = (rank: number, p: string[], h: string[], e: string[]) => ({ rank, place: "a place", evidence: { p, h, e } });
const base: LocationResponse = { location_candidates: [cand(1, [P1], [H3], []), cand(2, [P2], [H1], [E1]), cand(3, [P3], [H2], [])], extension: null, search_order: [1, 2, 3] };
eq(validateLocation(base, sel), "OK", "valid 3-candidate response passes");

// Valid single root extension whose src is a direct key cited by its target candidate.
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: P1, relationship: "A document pouch is a direct container for a passport." } }, sel), "OK", "valid root extension");

// The 10 negatives (§3.8 / §16).
eq(validateLocation({ location_candidates: [cand(1, [P1], [], []), cand(2, [], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_NO_DIRECT_EVIDENCE", "N: empty evidence");
eq(validateLocation({ location_candidates: [cand(1, [P1], [], []), cand(2, [], [], [])], extension: { candidate_rank: 1, src: P1, relationship: "r" }, search_order: [1, 2] }, sel), "DICE_LOCATION_NO_DIRECT_EVIDENCE", "N: empty evidence even with extension");
eq(validateLocation({ location_candidates: [cand(1, [], [H1], []), cand(2, [P1], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_PLANET_NOT_PRIMARY", "N: rank1 no planet");
eq(validateLocation({ location_candidates: [cand(1, ["p_nope"], [], []), cand(2, [P1], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_UNSELECTED_SOURCE", "N: unselected key");
eq(validateLocation({ location_candidates: [cand(1, [P1, P1], [], []), cand(2, [P2], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_DUPLICATE_EVIDENCE_KEY", "N: duplicate key");
eq(validateLocation({ location_candidates: [cand(1, [P1, P2, P3], [], []), cand(2, [P2], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_EVIDENCE_ARRAY_TOO_LONG", "N: 3 keys");
eq(validateLocation({ ...base, extension: { candidate_rank: 9, src: P1, relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_RANK_NOT_FOUND", "N: extension rank missing");
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: P2, relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_PARENT_NOT_CITED", "N: extension src not cited by target");
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: "p_nope", relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_PARENT_NOT_CITED", "N: extension src unselected");
eq(validateLocation({ ...base, search_order: [2, 1] }, sel), "DICE_LOCATION_SEARCH_ORDER", "N: search_order out of order");
eq(validateLocation({ location_candidates: [cand(1, [P1], [], [])], extension: null, search_order: [1] } as any, sel), "DICE_LOCATION_CANDIDATE_COUNT", "N: candidate count 1");

// Assembler expands short semantic keys to stable global ids.
const respOk = { status: "ok", most_likely_area: "at home", synthesis: "Home first, then narrower spots, then heat side.",
  location_candidates: base.location_candidates, extension: null, search_order: [1, 2, 3],
  watch_out: "Do not check only obvious spots.", practical_step: "Start with the bedroom, then living areas." };
const parsed = parseDiceV05Stage2("location", "en", JSON.stringify(respOk));
ok(parsed && parsed.kind === "ok", "location parse ok");
const final = assembleLocation("en", (parsed as any).value, res.gid) as any;
eq(final.location_candidates[0].evidence.planet_ids, [res.gid[P1]], "gid expand P1 -> its planet.<id>.related.<slug>");
eq(final.location_candidates[0].evidence.house_ids, [res.gid[H3]], "gid expand H3 -> its house.<n>.related.<slug>");
ok(res.gid[P1] === "planet.moon.related.family_home" && res.gid[H3] === "house.4.related.under_furniture", "gids are semantic + stable");
eq(final.location_search_order, [1, 2, 3], "final search order carried");
ok(final.planet_side === null && final.timing_summary === null && Array.isArray(final.suggested_followups) && final.suggested_followups.length === 0, "location per-mode presence");

/* ---- §20.4 coverage: EVERY Planet, House and Element bank is wired, complete, and gid-mapped ---- */
// All 12 planets: the envelope carries the full related list + theme/context, each with a gid.
for (const planet of DICE_V05_PLANET_IDS) {
  const r = buildLocationResolution("en", planet, "aries", 1);
  const pp: any = (r.envelope as any).given.planet_place;
  eq(pp.related.length, LOCATION_PLANET_BANK[planet].related.length, `planet ${planet} related count == bank`);
  ok(pp.related.length >= 5, `planet ${planet} has >=5 related places (not summarised)`);
  for (const k of r.selectedKeys.p) ok(typeof r.gid[k] === "string" && r.gid[k].startsWith("planet."), `planet ${planet} key ${k} has planet gid`);
}
// All 12 houses: setting/context + full related + fixed distance.
for (let h = 1; h <= 12; h++) {
  const r = buildLocationResolution("en", "sun", "aries", h);
  const hp: any = (r.envelope as any).given.house_place;
  eq(hp.related.length, LOCATION_HOUSE_BANK[h].related.length, `house ${h} related count == bank`);
  ok(["near", "middle", "far"].includes(hp.distance), `house ${h} fixed distance present`);
  for (const k of r.selectedKeys.h) ok(typeof r.gid[k] === "string" && r.gid[k].startsWith("house."), `house ${h} key ${k} has house gid`);
}
// All 4 elements (one sign each): exact place count + every place gid-mapped.
for (const sign of DICE_V05_SIGN_IDS) {
  const el = SIGN_ELEMENT[sign];
  const r = buildLocationResolution("en", "sun", sign, 1);
  const se: any = (r.envelope as any).given.sign_element;
  eq(se.element, el, `sign ${sign} element`);
  eq(se.places.length, ELEMENT_TABLE[el].places.length, `sign ${sign} (${el}) element place count`);
  for (const k of r.selectedKeys.e) ok(typeof r.gid[k] === "string" && r.gid[k].startsWith("element."), `element key ${k} has element gid`);
}
// The exact Element table incl. the restored Air clues (reviewer gap): mountain/high ground + off the floor.
{
  const airSlugs = ELEMENT_TABLE.Air.places.map((p) => p.slug);
  ok(airSlugs.includes("mountain_high_ground") && airSlugs.includes("off_the_floor"), "Air element includes mountain/high-ground and off-the-floor");
  eq(ELEMENT_TABLE.Air.places.length, 5, "Air element has 5 places");
  eq(ELEMENT_TABLE.Water.places.length, 5, "Water element has 5 places (bathroom/kitchen split)");
}

console.log("dice-v0-5 location fixtures passed");
