/** v5 Location fixtures — validateLocation (§16, 12 cases), gid expansion, assembler. */
import { parseDiceV05Stage2, validateLocation, type LocationResponse, type LocationSelectedKeys } from "./dice-v0-5-interpretation-contract.ts";
import { buildLocationResolution, assembleLocation } from "./dice-v0-5-presentation.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Moon / Leo (Fire) / House 4 — the controlled selected key set.
const res = buildLocationResolution("en", "moon", "leo", 4);
const sel: LocationSelectedKeys = res.selectedKeys;
ok(sel.p.includes("p1") && sel.h.includes("h3") && sel.e.includes("e1"), "selected keys present");

const cand = (rank: number, p: string[], h: string[], e: string[]) => ({ rank, place: "a place", evidence: { p, h, e } });
const base: LocationResponse = { location_candidates: [cand(1, ["p1"], ["h3"], []), cand(2, ["p2"], ["h1"], ["e1"]), cand(3, ["p3"], ["h2"], [])], extension: null, search_order: [1, 2, 3] };
eq(validateLocation(base, sel), "OK", "valid 3-candidate response passes");

// Valid single root extension whose src is cited by its target candidate.
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: "p1", relationship: "A document pouch is a direct container for a passport." } }, sel), "OK", "valid root extension");

// The 10 negatives (§3.8 / §16).
eq(validateLocation({ location_candidates: [cand(1, ["p1"], [], []), cand(2, [], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_NO_DIRECT_EVIDENCE", "N: empty evidence");
eq(validateLocation({ location_candidates: [cand(1, ["p1"], [], []), cand(2, [], [], [])], extension: { candidate_rank: 1, src: "p1", relationship: "r" }, search_order: [1, 2] }, sel), "DICE_LOCATION_NO_DIRECT_EVIDENCE", "N: empty evidence even with extension");
eq(validateLocation({ location_candidates: [cand(1, [], ["h1"], []), cand(2, ["p1"], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_PLANET_NOT_PRIMARY", "N: rank1 no planet");
eq(validateLocation({ location_candidates: [cand(1, ["p9"], [], []), cand(2, ["p1"], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_UNSELECTED_SOURCE", "N: unselected key");
eq(validateLocation({ location_candidates: [cand(1, ["p1", "p1"], [], []), cand(2, ["p2"], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_DUPLICATE_EVIDENCE_KEY", "N: duplicate key");
eq(validateLocation({ location_candidates: [cand(1, ["p1", "p2", "p3"], [], []), cand(2, ["p2"], [], [])], extension: null, search_order: [1, 2] }, sel), "DICE_LOCATION_EVIDENCE_ARRAY_TOO_LONG", "N: 3 keys");
eq(validateLocation({ ...base, extension: { candidate_rank: 9, src: "p1", relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_RANK_NOT_FOUND", "N: extension rank missing");
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: "p2", relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_PARENT_NOT_CITED", "N: extension src not cited by target");
eq(validateLocation({ ...base, extension: { candidate_rank: 1, src: "zz", relationship: "r" } }, sel), "DICE_LOCATION_EXTENSION_PARENT_NOT_CITED", "N: extension src unselected");
eq(validateLocation({ ...base, search_order: [2, 1] }, sel), "DICE_LOCATION_SEARCH_ORDER", "N: search_order out of order");
eq(validateLocation({ location_candidates: [cand(1, ["p1"], [], [])], extension: null, search_order: [1] } as any, sel), "DICE_LOCATION_CANDIDATE_COUNT", "N: candidate count 1");

// Assembler expands short keys to stable global ids.
const respOk = { status: "ok", most_likely_area: "at home", synthesis: "Home first, then narrower spots, then heat side.",
  location_candidates: base.location_candidates, extension: null, search_order: [1, 2, 3],
  watch_out: "Do not check only obvious spots.", practical_step: "Start with the bedroom, then living areas." };
const parsed = parseDiceV05Stage2("location", "en", JSON.stringify(respOk));
ok(parsed && parsed.kind === "ok", "location parse ok");
const final = assembleLocation("en", (parsed as any).value, res.gid) as any;
eq(final.location_candidates[0].evidence.planet_ids, ["planet.moon.related.1"], "gid expand p1 -> planet.moon.related.1");
eq(final.location_candidates[0].evidence.house_ids, ["house.4.related.3"], "gid expand h3 -> house.4.related.3");
eq(final.location_search_order, [1, 2, 3], "final search order carried");
ok(final.planet_side === null && final.timing_summary === null && Array.isArray(final.suggested_followups) && final.suggested_followups.length === 0, "location per-mode presence");

console.log("dice-v0-5 location fixtures passed");
